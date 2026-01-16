// Script execution engine for pre-request scripts
// Provides a sandboxed environment for running user JavaScript code

export interface ScriptContext {
  request: {
    body: any
    headers: Record<string, string>
    url: string
  }
  environment: Record<string, string>
}

export interface ScriptResult {
  success: boolean
  logs: string[]
  error?: string
  context: ScriptContext
}

// Build the pm API object that scripts can use
function buildPmAPI(context: ScriptContext) {
  const pm = {
    request: {
      url: {
        get: () => context.request.url,
        set: (url: string) => {
          context.request.url = url
        },
      },
      headers: {
        add: (key: string, value: string) => {
          context.request.headers[key] = value
        },
        remove: (key: string) => {
          delete context.request.headers[key]
        },
        get: (key: string) => context.request.headers[key],
        upsert: (key: string, value: string) => {
          context.request.headers[key] = value
        },
      },
      body: {
        get: () => context.request.body,
        set: (body: any) => {
          context.request.body = body
        },
      },
    },
    environment: {
      get: (key: string) => context.environment[key],
      set: (key: string, value: string) => {
        context.environment[key] = value
      },
      unset: (key: string) => {
        delete context.environment[key]
      },
      has: (key: string) => key in context.environment,
    },
  }

  return pm
}

// Execute user script in a restricted environment
export function executeScript(scriptCode: string, context: ScriptContext): ScriptResult {
  const logs: string[] = []

  // Create safe console that captures logs
  const safeConsole = {
    log: (...args: any[]) => {
      logs.push(args.map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' '))
    },
    error: (...args: any[]) => {
      logs.push('[ERROR] ' + args.map(String).join(' '))
    },
    warn: (...args: any[]) => {
      logs.push('[WARN] ' + args.map(String).join(' '))
    },
    info: (...args: any[]) => {
      logs.push('[INFO] ' + args.map(String).join(' '))
    },
  }

  // Build the pm API
  const pm = buildPmAPI(context)

  // Create restricted global scope - allow safe built-ins, block dangerous ones
  const sandbox = {
    pm,
    console: safeConsole,
    // Safe globals
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    // Block dangerous globals
    window: undefined,
    document: undefined,
    eval: undefined,
    Function: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    WebSocket: undefined,
    importScripts: undefined,
  }

  try {
    // Create function with restricted scope
    const paramNames = Object.keys(sandbox)
    const paramValues = Object.values(sandbox)

    // eslint-disable-next-line no-new-func
    const userFunction = new Function(...paramNames, scriptCode)

    // Execute the script
    userFunction(...paramValues)

    return {
      success: true,
      logs,
      context,
    }
  } catch (error) {
    return {
      success: false,
      logs,
      error: error instanceof Error ? error.message : String(error),
      context,
    }
  }
}
