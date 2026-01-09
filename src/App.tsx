import { useState, useEffect, useCallback } from 'react'
import {
  loadProtoFiles,
  createEmptyRequest,
  executeCall,
  extractFields,
  type ServiceMeta,
  type MethodMeta,
  type CallResult,
  type FieldMeta,
} from './lib/proto-loader'
import './App.css'

// Check if running in Tauri
const isTauri = typeof window !== 'undefined' &&
  (('__TAURI__' in window) || ('__TAURI_INTERNALS__' in window))

const DEFAULT_URL = 'https://example.com'
const STORAGE_KEY = 'gx-ui-state'

const jsonStringify = (obj: unknown) =>
  JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)

// Persistence helpers
interface PersistedState {
  baseUrl: string
  headersText: string
  methodCache: Record<string, MethodCache>
}

function loadPersistedState(): Partial<PersistedState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.warn('Failed to load persisted state:', e)
  }
  return {}
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save state:', e)
  }
}

// Parse headers from textarea format (newline separated, key:value)
function parseHeaders(headersText: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of headersText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim()
      const value = trimmed.slice(colonIndex + 1).trim()
      if (key) headers[key] = value
    }
  }
  return headers
}

interface MethodCache {
  request: string
  defaultRequest: string
  result: CallResult | null
}

// Recursive field documentation component
function FieldDoc({ field, depth = 0 }: { field: FieldMeta; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasNested = field.kind === 'message' && field.messageType

  return (
    <div className="field-doc" style={{ marginLeft: depth * 12 }}>
      <div className="field-header" onClick={() => hasNested && setExpanded(!expanded)}>
        <span className="field-name">
          {hasNested && <span className="expand-icon">{expanded ? '▼' : '▶'}</span>}
          {field.name}
        </span>
        <span className="field-type">
          {field.repeated && 'repeated '}
          {field.optional && 'optional '}
          {field.type}
        </span>
      </div>

      {field.kind === 'enum' && field.enumValues && (
        <div className="enum-values">
          {field.enumValues.map(([name, value]) => (
            <div key={name} className="enum-value">
              <span className="enum-name">{name}</span>
              <span className="enum-num">= {value}</span>
            </div>
          ))}
        </div>
      )}

      {hasNested && expanded && field.messageType && (
        <div className="nested-fields">
          {extractFields(field.messageType).map((f) => (
            <FieldDoc key={f.name} field={f} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function DocPanel({ method }: { method: MethodMeta }) {
  const [tab, setTab] = useState<'request' | 'response'>('request')
  const fields = tab === 'request' ? method.inputFields : method.outputFields
  const typeName = tab === 'request' ? method.inputType.name : method.outputType.name

  return (
    <div className="doc-panel">
      <div className="doc-tabs">
        <button
          className={`doc-tab ${tab === 'request' ? 'active' : ''}`}
          onClick={() => setTab('request')}
        >
          Request
        </button>
        <button
          className={`doc-tab ${tab === 'response' ? 'active' : ''}`}
          onClick={() => setTab('response')}
        >
          Response
        </button>
      </div>

      <div className="doc-content">
        <div className="type-header">{typeName}</div>
        {fields.length === 0 ? (
          <div className="empty-fields">No fields</div>
        ) : (
          <div className="fields-list">
            {fields.map((field) => (
              <FieldDoc key={field.name} field={field} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MethodPanel({
  service,
  method,
  baseUrl,
  headersText,
  cache,
  onCacheUpdate,
}: {
  service: ServiceMeta
  method: MethodMeta
  baseUrl: string
  headersText: string
  cache: MethodCache | undefined
  onCacheUpdate: (request: string, defaultRequest: string, result: CallResult | null) => void
}) {
  const [jsonText, setJsonText] = useState('')
  const [result, setResult] = useState<CallResult | null>(null)
  const [loading, setLoading] = useState(false)

  const defaultRequest = jsonStringify(createEmptyRequest(method))

  useEffect(() => {
    if (cache) {
      // If default format changed (e.g. proto updated), reset to new default
      if (cache.defaultRequest !== defaultRequest && cache.request === cache.defaultRequest) {
        setJsonText(defaultRequest)
        setResult(null)
        onCacheUpdate(defaultRequest, defaultRequest, null)
      } else {
        setJsonText(cache.request)
        setResult(cache.result)
      }
    } else {
      setJsonText(defaultRequest)
      setResult(null)
      onCacheUpdate(defaultRequest, defaultRequest, null)
    }
  }, [method, cache, onCacheUpdate, defaultRequest])

  const handleJsonChange = (value: string) => {
    setJsonText(value)
    onCacheUpdate(value, defaultRequest, result)
  }

  const handleExecute = async () => {
    setLoading(true)
    try {
      const reqData = JSON.parse(jsonText)
      const headers = parseHeaders(headersText)
      const res = await executeCall(service, method, reqData, baseUrl, Object.keys(headers).length > 0 ? headers : undefined)
      setResult(res)
      onCacheUpdate(jsonText, defaultRequest, res)
    } catch (err) {
      const errorResult: CallResult = {
        response: null,
        error: err instanceof Error ? err.message : String(err),
        duration: 0,
        status: 'error',
      }
      setResult(errorResult)
      onCacheUpdate(jsonText, defaultRequest, errorResult)
    }
    setLoading(false)
  }

  return (
    <div className="method-panel">
      <div className="panel-header">
        <h3>{method.name}</h3>
        <div className="type-info">
          <span className="req-type">{method.inputType.name}</span>
          <span className="arrow">→</span>
          <span className="res-type">{method.outputType.name}</span>
        </div>
      </div>

      <div className="request-section">
        <div className="section-header">
          <h4>Request</h4>
        </div>
        <textarea
          className="json-editor"
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          rows={12}
          spellCheck={false}
        />
        <button
          className="execute-btn"
          onClick={handleExecute}
          disabled={loading}
        >
          {loading ? 'Executing...' : 'Execute'}
        </button>
      </div>

      {result && (
        <div className={`response-section ${result.status}`}>
          <div className="section-header">
            <h4>Response</h4>
            <span className="duration">{result.duration.toFixed(2)}ms</span>
          </div>
          <pre className="response-json">
            {result.status === 'error'
              ? String(result.error)
              : jsonStringify(result.response)}
          </pre>
        </div>
      )}
    </div>
  )
}

function App() {
  // Load persisted state on mount
  const [persisted] = useState(() => loadPersistedState())

  const [protoPath, setProtoPath] = useState('')
  const [services, setServices] = useState<ServiceMeta[]>([])
  const [selectedService, setSelectedService] = useState<ServiceMeta | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<MethodMeta | null>(null)
  const [baseUrl, setBaseUrl] = useState(persisted.baseUrl || DEFAULT_URL)
  const [headersText, setHeadersText] = useState(persisted.headersText || '')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDocPanel, setShowDocPanel] = useState(true)
  const [methodCache, setMethodCache] = useState<Map<string, MethodCache>>(() => {
    if (persisted.methodCache) {
      return new Map(Object.entries(persisted.methodCache))
    }
    return new Map()
  })

  // Save state to localStorage when it changes
  useEffect(() => {
    savePersistedState({
      baseUrl,
      headersText,
      methodCache: Object.fromEntries(methodCache),
    })
  }, [baseUrl, headersText, methodCache])

  const getMethodKey = (service: ServiceMeta, method: MethodMeta) =>
    `${protoPath}:${service.fullName}.${method.name}`

  const handleCacheUpdate = useCallback((service: ServiceMeta, method: MethodMeta, request: string, defaultRequest: string, result: CallResult | null) => {
    const key = `${protoPath}:${service.fullName}.${method.name}`
    setMethodCache(prev => {
      const next = new Map(prev)
      next.set(key, { request, defaultRequest, result })
      return next
    })
  }, [protoPath])

  const isMethodDirty = (service: ServiceMeta, method: MethodMeta) => {
    const cache = methodCache.get(getMethodKey(service, method))
    if (!cache) return false
    return cache.request !== cache.defaultRequest || cache.result !== null
  }

  const loadProtos = useCallback(async (dirPath: string) => {
    setLoading(true)
    setError('')
    setServices([])
    setSelectedService(null)
    setSelectedMethod(null)

    try {
      const protoFiles: Array<{ filename: string; content: string }> = []

      if (isTauri) {
        // Use Tauri fs API
        const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs')

        async function readProtoFilesRecursive(dir: string) {
          const entries = await readDir(dir)
          for (const entry of entries) {
            const fullPath = `${dir}/${entry.name}`
            if (entry.isDirectory) {
              await readProtoFilesRecursive(fullPath)
            } else if (entry.name?.endsWith('.proto')) {
              try {
                const content = await readTextFile(fullPath)
                protoFiles.push({ filename: entry.name, content })
              } catch (e) {
                console.warn(`Failed to read ${fullPath}:`, e)
              }
            }
          }
        }

        await readProtoFilesRecursive(dirPath)
      } else {
        setError('File system access requires the desktop app. Use "Paste Proto" to paste proto content directly.')
        setLoading(false)
        return
      }

      if (protoFiles.length === 0) {
        setError('No .proto files found in directory')
        setLoading(false)
        return
      }

      const result = await loadProtoFiles(protoFiles)

      if (result.error) {
        setError(result.error)
      } else if (result.services.length === 0) {
        setError('No services found in proto files')
      } else {
        setServices(result.services)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }

    setLoading(false)
  }, [])

  const handleSelectDirectory = async () => {
    if (isTauri) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Proto Files Directory',
        })

        if (selected && typeof selected === 'string') {
          setProtoPath(selected)
          await loadProtos(selected)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } else {
      // Use browser File System Access API
      try {
        const dirHandle = await (window as any).showDirectoryPicker()
        await loadFromDirectoryHandle(dirHandle)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }
  }

  const loadFromDirectoryHandle = async (dirHandle: any) => {
    setLoading(true)
    setError('')
    setServices([])
    setSelectedService(null)
    setSelectedMethod(null)

    const protoFiles: Array<{ filename: string; content: string }> = []

    async function readRecursive(handle: any, path: string = '') {
      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') {
          await readRecursive(entry, `${path}${entry.name}/`)
        } else if (entry.name.endsWith('.proto')) {
          const file = await entry.getFile()
          const content = await file.text()
          protoFiles.push({ filename: `${path}${entry.name}`, content })
        }
      }
    }

    try {
      await readRecursive(dirHandle)

      if (protoFiles.length === 0) {
        setError('No .proto files found in directory')
        setLoading(false)
        return
      }

      setProtoPath(dirHandle.name)
      const result = await loadProtoFiles(protoFiles)

      if (result.error) {
        setError(result.error)
      } else if (result.services.length === 0) {
        setError('No services found in proto files')
      } else {
        setServices(result.services)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }

    setLoading(false)
  }

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProtoPath(e.target.value)
  }

  const handlePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (protoPath) {
      await loadProtos(protoPath)
    }
  }

  const filteredServices = services.filter(s =>
    s.shortName.toLowerCase().includes(search.toLowerCase()) ||
    s.methods.some(m => m.name.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredMethods = selectedService?.methods.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="app">
      <header className="header">
        <h1>GX UI</h1>
        <div className="config">
          <input
            type="text"
            placeholder="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="url-input"
          />
          <textarea
            placeholder="Headers (one per line, key: value)"
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
            className="headers-input"
            rows={2}
          />
        </div>
        <button
          className={`doc-toggle ${showDocPanel ? 'active' : ''}`}
          onClick={() => setShowDocPanel(!showDocPanel)}
          title={showDocPanel ? 'Hide Docs' : 'Show Docs'}
        >
          ◨
        </button>
      </header>

      <div className="proto-loader">
        <form onSubmit={handlePathSubmit} className="proto-form">
          <input
            type="text"
            placeholder="Path to proto files directory..."
            value={protoPath}
            onChange={handlePathChange}
            className="proto-path-input"
          />
          <button type="button" onClick={handleSelectDirectory} className="browse-btn">
            Browse
          </button>
          <button type="submit" className="load-btn" disabled={loading || !protoPath}>
            {loading ? 'Loading...' : 'Load'}
          </button>
        </form>
        {error && <div className="error-msg">{error}</div>}
      </div>

      <div className="main">
        <aside className="sidebar">
          <input
            type="text"
            placeholder="Search services/methods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />

          <div className="services-list">
            {filteredServices.map((service) => (
              <div
                key={service.fullName}
                className={`service-item ${selectedService?.fullName === service.fullName ? 'selected' : ''}`}
              >
                <div
                  className="service-name"
                  onClick={() => {
                    setSelectedService(service)
                    setSelectedMethod(null)
                  }}
                >
                  {service.shortName}
                  <span className="method-count">{service.methods.length}</span>
                </div>

                {selectedService?.fullName === service.fullName && (
                  <div className="methods-list">
                    {filteredMethods.map((method) => {
                      const isDirty = isMethodDirty(service, method)
                      return (
                        <div
                          key={method.name}
                          className={`method-item ${selectedMethod?.name === method.name ? 'selected' : ''}`}
                          onClick={() => setSelectedMethod(method)}
                        >
                          {isDirty && <span className="cache-dot" />}
                          {method.name}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {services.length > 0 && (
            <div className="stats">
              {services.length} services, {services.reduce((acc, s) => acc + s.methods.length, 0)} methods
            </div>
          )}
        </aside>

        <main className="content">
          {selectedService && selectedMethod ? (
            <MethodPanel
              key={getMethodKey(selectedService, selectedMethod)}
              service={selectedService}
              method={selectedMethod}
              baseUrl={baseUrl}
              headersText={headersText}
              cache={methodCache.get(getMethodKey(selectedService, selectedMethod))}
              onCacheUpdate={(request, defaultRequest, result) => handleCacheUpdate(selectedService, selectedMethod, request, defaultRequest, result)}
            />
          ) : (
            <div className="placeholder">
              {services.length === 0 ? (
                <p>Select a directory containing .proto files to get started.</p>
              ) : (
                <p>Select a service and method from the sidebar.</p>
              )}
            </div>
          )}
        </main>

        {selectedMethod && showDocPanel && <DocPanel method={selectedMethod} />}
      </div>
    </div>
  )
}

export default App
