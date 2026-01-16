import { useState } from 'react'
import { executeScript, type ScriptContext } from '../lib/script-executor'

interface PreScriptState {
  code: string
  environment: Record<string, string>
  enabled: boolean
}

interface PreScriptModalProps {
  preScriptState: PreScriptState
  onSave: (state: PreScriptState) => void
  onClose: () => void
}

const EXAMPLE_SCRIPT = `// Example pre-script
// Set timestamp
const timestamp = new Date().toISOString()
pm.environment.set('timestamp', timestamp)

// Add auth header
const token = pm.environment.get('auth_token') || 'default-token'
pm.request.headers.add('Authorization', \`Bearer \${token}\`)

// Modify request body
const body = pm.request.body.get()
body.requestId = Date.now()
body.timestamp = timestamp
pm.request.body.set(body)

// Debug logging
console.log('Request ID:', body.requestId)
console.log('Auth token:', token)`

export function PreScriptModal({ preScriptState, onSave, onClose }: PreScriptModalProps) {
  const [tab, setTab] = useState<'script' | 'environment'>('script')
  const [code, setCode] = useState(preScriptState.code)
  const [environment, setEnvironment] = useState(preScriptState.environment)
  const [enabled, setEnabled] = useState(preScriptState.enabled)
  const [testLogs, setTestLogs] = useState<string[]>([])
  const [testError, setTestError] = useState<string | null>(null)

  const handleSave = () => {
    onSave({ code, environment, enabled })
    onClose()
  }

  const handleTestScript = () => {
    setTestLogs([])
    setTestError(null)

    try {
      const testContext: ScriptContext = {
        request: {
          body: { test: 'example' },
          headers: { 'Content-Type': 'application/json' },
          url: 'https://example.com',
        },
        environment: { ...environment },
      }

      const result = executeScript(code, testContext)

      if (result.success) {
        setTestLogs([...result.logs, '✓ Script executed successfully'])
      } else {
        setTestLogs(result.logs)
        setTestError(result.error || 'Unknown error')
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAddEnvVar = () => {
    const key = prompt('Enter variable name:')
    if (key && !environment[key]) {
      setEnvironment({ ...environment, [key]: '' })
    }
  }

  const handleUpdateEnvVar = (key: string, value: string) => {
    setEnvironment({ ...environment, [key]: value })
  }

  const handleDeleteEnvVar = (key: string) => {
    const newEnv = { ...environment }
    delete newEnv[key]
    setEnvironment(newEnv)
  }

  const handleLoadExample = () => {
    if (confirm('Load example script? This will replace your current script.')) {
      setCode(EXAMPLE_SCRIPT)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <h2>Pre-Script Settings</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${tab === 'script' ? 'active' : ''}`}
            onClick={() => setTab('script')}
          >
            Script
          </button>
          <button
            className={`tab ${tab === 'environment' ? 'active' : ''}`}
            onClick={() => setTab('environment')}
          >
            Environment Variables
          </button>
        </div>

        <div className="modal-body">
          {tab === 'script' && (
            <div className="script-tab">
              <div className="script-controls">
                <label className="enable-checkbox">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Enable pre-script
                </label>
                <button className="example-button" onClick={handleLoadExample}>
                  Load Example
                </button>
              </div>

              <textarea
                className="script-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Write your pre-request script here&#10;// Use pm.request, pm.environment, and console.log()&#10;&#10;// Example:&#10;// pm.request.headers.add('X-Custom-Header', 'value')"
                spellCheck={false}
              />

              <div className="console-output">
                <div className="console-header">
                  <span>Console Output</span>
                  <button className="test-button" onClick={handleTestScript}>
                    Test Script
                  </button>
                </div>
                <div className="console-content">
                  {testLogs.length === 0 && !testError && (
                    <div className="console-empty">Click "Test Script" to see output</div>
                  )}
                  {testLogs.map((log, i) => (
                    <div key={i} className="console-log">{log}</div>
                  ))}
                  {testError && (
                    <div className="console-error">✗ Error: {testError}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'environment' && (
            <div className="environment-tab">
              <div className="env-controls">
                <button className="add-button" onClick={handleAddEnvVar}>
                  + Add Variable
                </button>
              </div>

              <div className="env-list">
                {Object.keys(environment).length === 0 && (
                  <div className="env-empty">No environment variables. Click "Add Variable" to create one.</div>
                )}
                {Object.entries(environment).map(([key, value]) => (
                  <div key={key} className="env-item">
                    <input
                      type="text"
                      className="env-key"
                      value={key}
                      disabled
                    />
                    <input
                      type="text"
                      className="env-value"
                      value={value}
                      onChange={(e) => handleUpdateEnvVar(key, e.target.value)}
                      placeholder="Value"
                    />
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteEnvVar(key)}
                      title="Delete variable"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
