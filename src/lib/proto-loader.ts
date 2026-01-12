/* eslint-disable @typescript-eslint/no-explicit-any */
import * as protobuf from 'protobufjs'

// Google well-known types definitions
const GOOGLE_PROTOBUF_TYPES = `
syntax = "proto3";
package google.protobuf;

message Timestamp {
  int64 seconds = 1;
  int32 nanos = 2;
}

message Duration {
  int64 seconds = 1;
  int32 nanos = 2;
}

message Empty {}

message Any {
  string type_url = 1;
  bytes value = 2;
}

message StringValue {
  string value = 1;
}

message Int32Value {
  int32 value = 1;
}

message Int64Value {
  int64 value = 1;
}

message UInt32Value {
  uint32 value = 1;
}

message UInt64Value {
  uint64 value = 1;
}

message FloatValue {
  float value = 1;
}

message DoubleValue {
  double value = 1;
}

message BoolValue {
  bool value = 1;
}

message BytesValue {
  bytes value = 1;
}

message Struct {
  map<string, Value> fields = 1;
}

message Value {
  oneof kind {
    NullValue null_value = 1;
    double number_value = 2;
    string string_value = 3;
    bool bool_value = 4;
    Struct struct_value = 5;
    ListValue list_value = 6;
  }
}

enum NullValue {
  NULL_VALUE = 0;
}

message ListValue {
  repeated Value values = 1;
}

message FieldMask {
  repeated string paths = 1;
}
`

export interface FieldMeta {
  no: number
  name: string
  jsonName: string
  kind: 'scalar' | 'message' | 'enum' | 'map'
  type: string
  repeated: boolean
  optional: boolean
  enumValues?: Array<[string, number]>
  messageType?: protobuf.Type
}

export interface MethodMeta {
  name: string
  camelName: string
  inputType: protobuf.Type
  outputType: protobuf.Type
  inputFields: FieldMeta[]
  outputFields: FieldMeta[]
  fullPath: string
}

export interface ServiceMeta {
  fullName: string
  shortName: string
  methods: MethodMeta[]
}

export interface LoadResult {
  services: ServiceMeta[]
  root: protobuf.Root
  error?: string
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function getScalarTypeName(type: string): string {
  const scalarTypes: Record<string, string> = {
    'double': 'double', 'float': 'float', 'int32': 'int32', 'int64': 'int64',
    'uint32': 'uint32', 'uint64': 'uint64', 'sint32': 'sint32', 'sint64': 'sint64',
    'fixed32': 'fixed32', 'fixed64': 'fixed64', 'sfixed32': 'sfixed32', 'sfixed64': 'sfixed64',
    'bool': 'bool', 'string': 'string', 'bytes': 'bytes',
  }
  return scalarTypes[type] || type
}

export function extractFields(msgType: protobuf.Type): FieldMeta[] {
  const fields: FieldMeta[] = []

  for (const field of msgType.fieldsArray) {
    const isScalar = ['double', 'float', 'int32', 'int64', 'uint32', 'uint64',
                      'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
                      'bool', 'string', 'bytes'].includes(field.type)

    let kind: FieldMeta['kind'] = 'scalar'
    let enumValues: Array<[string, number]> | undefined
    let messageType: protobuf.Type | undefined

    if (field.resolvedType) {
      if (field.resolvedType instanceof protobuf.Enum) {
        kind = 'enum'
        enumValues = Object.entries(field.resolvedType.values).map(
          ([name, value]) => [name, value as number]
        )
      } else if (field.resolvedType instanceof protobuf.Type) {
        kind = 'message'
        messageType = field.resolvedType
      }
    } else if (field.map) {
      kind = 'map'
    }

    fields.push({
      no: field.id,
      name: field.name,
      jsonName: field.name,
      kind,
      type: isScalar ? getScalarTypeName(field.type) : field.type.split('.').pop() || field.type,
      repeated: field.repeated,
      optional: field.optional,
      enumValues,
      messageType,
    })
  }

  return fields
}

export async function loadProtoFiles(protoContents: Array<{ filename: string; content: string }>): Promise<LoadResult> {
  try {
    const root = new protobuf.Root()

    // Define Google well-known types using protobufjs common
    protobuf.common('google/protobuf/timestamp.proto', {
      nested: {
        google: {
          nested: {
            protobuf: {
              nested: {
                Timestamp: {
                  fields: {
                    seconds: { type: 'int64', id: 1 },
                    nanos: { type: 'int32', id: 2 }
                  }
                }
              }
            }
          }
        }
      }
    })

    protobuf.common('google/protobuf/duration.proto', {
      nested: {
        google: {
          nested: {
            protobuf: {
              nested: {
                Duration: {
                  fields: {
                    seconds: { type: 'int64', id: 1 },
                    nanos: { type: 'int32', id: 2 }
                  }
                }
              }
            }
          }
        }
      }
    })

    protobuf.common('google/protobuf/empty.proto', {
      nested: {
        google: {
          nested: {
            protobuf: {
              nested: {
                Empty: { fields: {} }
              }
            }
          }
        }
      }
    })

    protobuf.common('google/protobuf/any.proto', {
      nested: {
        google: {
          nested: {
            protobuf: {
              nested: {
                Any: {
                  fields: {
                    type_url: { type: 'string', id: 1 },
                    value: { type: 'bytes', id: 2 }
                  }
                }
              }
            }
          }
        }
      }
    })

    protobuf.common('google/protobuf/wrappers.proto', {
      nested: {
        google: {
          nested: {
            protobuf: {
              nested: {
                StringValue: { fields: { value: { type: 'string', id: 1 } } },
                BytesValue: { fields: { value: { type: 'bytes', id: 1 } } },
                BoolValue: { fields: { value: { type: 'bool', id: 1 } } },
                Int32Value: { fields: { value: { type: 'int32', id: 1 } } },
                Int64Value: { fields: { value: { type: 'int64', id: 1 } } },
                UInt32Value: { fields: { value: { type: 'uint32', id: 1 } } },
                UInt64Value: { fields: { value: { type: 'uint64', id: 1 } } },
                FloatValue: { fields: { value: { type: 'float', id: 1 } } },
                DoubleValue: { fields: { value: { type: 'double', id: 1 } } }
              }
            }
          }
        }
      }
    })

    protobuf.common('google/protobuf/field_mask.proto', {
      nested: {
        google: {
          nested: {
            protobuf: {
              nested: {
                FieldMask: {
                  fields: {
                    paths: { rule: 'repeated', type: 'string', id: 1 }
                  }
                }
              }
            }
          }
        }
      }
    })

    // Also add directly to this root
    const googleNs = root.define('google.protobuf')
    googleNs.add(new protobuf.Type('Timestamp')
      .add(new protobuf.Field('seconds', 1, 'int64'))
      .add(new protobuf.Field('nanos', 2, 'int32')))
    googleNs.add(new protobuf.Type('Duration')
      .add(new protobuf.Field('seconds', 1, 'int64'))
      .add(new protobuf.Field('nanos', 2, 'int32')))
    googleNs.add(new protobuf.Type('Empty'))
    googleNs.add(new protobuf.Type('Any')
      .add(new protobuf.Field('type_url', 1, 'string'))
      .add(new protobuf.Field('value', 2, 'bytes')))
    googleNs.add(new protobuf.Type('StringValue')
      .add(new protobuf.Field('value', 1, 'string')))
    googleNs.add(new protobuf.Type('BytesValue')
      .add(new protobuf.Field('value', 1, 'bytes')))
    googleNs.add(new protobuf.Type('Int32Value')
      .add(new protobuf.Field('value', 1, 'int32')))
    googleNs.add(new protobuf.Type('Int64Value')
      .add(new protobuf.Field('value', 1, 'int64')))
    googleNs.add(new protobuf.Type('UInt32Value')
      .add(new protobuf.Field('value', 1, 'uint32')))
    googleNs.add(new protobuf.Type('UInt64Value')
      .add(new protobuf.Field('value', 1, 'uint64')))
    googleNs.add(new protobuf.Type('FloatValue')
      .add(new protobuf.Field('value', 1, 'float')))
    googleNs.add(new protobuf.Type('DoubleValue')
      .add(new protobuf.Field('value', 1, 'double')))
    googleNs.add(new protobuf.Type('BoolValue')
      .add(new protobuf.Field('value', 1, 'bool')))
    googleNs.add(new protobuf.Type('FieldMask')
      .add(new protobuf.Field('paths', 1, 'string', 'repeated')))

    // Struct types
    googleNs.add(new protobuf.Enum('NullValue', { NULL_VALUE: 0 }))

    const listValueType = new protobuf.Type('ListValue')
    const valueType = new protobuf.Type('Value')
    const structType = new protobuf.Type('Struct')

    // Add Struct with map field
    structType.add(new protobuf.MapField('fields', 1, 'string', 'Value'))
    googleNs.add(structType)

    // Add Value with oneof
    valueType.add(new protobuf.Field('null_value', 1, 'NullValue'))
    valueType.add(new protobuf.Field('number_value', 2, 'double'))
    valueType.add(new protobuf.Field('string_value', 3, 'string'))
    valueType.add(new protobuf.Field('bool_value', 4, 'bool'))
    valueType.add(new protobuf.Field('struct_value', 5, 'Struct'))
    valueType.add(new protobuf.Field('list_value', 6, 'ListValue'))
    googleNs.add(valueType)

    // Add ListValue
    listValueType.add(new protobuf.Field('values', 1, 'Value', 'repeated'))
    googleNs.add(listValueType)

    // Parse all proto files
    for (const { filename, content } of protoContents) {
      try {
        protobuf.parse(content, root, { keepCase: true })
      } catch (e) {
        console.warn(`Failed to parse ${filename}:`, e)
      }
    }

    // Resolve all types
    root.resolveAll()

    // Extract services
    const services: ServiceMeta[] = []

    function findServices(ns: protobuf.NamespaceBase, prefix: string = '') {
      for (const nested of ns.nestedArray) {
        const fullName = prefix ? `${prefix}.${nested.name}` : nested.name

        if (nested instanceof protobuf.Service) {
          const methods: MethodMeta[] = []

          for (const method of nested.methodsArray) {
            const inputType = root.lookupType(method.requestType)
            const outputType = root.lookupType(method.responseType)

            methods.push({
              name: method.name,
              camelName: toCamelCase(method.name),
              inputType,
              outputType,
              inputFields: extractFields(inputType),
              outputFields: extractFields(outputType),
              fullPath: `/${fullName}/${method.name}`,
            })
          }

          services.push({
            fullName,
            shortName: nested.name,
            methods,
          })
        } else if (nested instanceof protobuf.Namespace) {
          findServices(nested, fullName)
        }
      }
    }

    findServices(root)

    return { services, root }
  } catch (error) {
    return {
      services: [],
      root: new protobuf.Root(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function getScalarDefault(type: string): unknown {
  switch (type) {
    case 'string': return ''
    case 'bool': return false
    case 'int64': case 'uint64': case 'sint64': case 'fixed64': case 'sfixed64':
    case 'int32': case 'uint32': case 'sint32': case 'fixed32': case 'sfixed32':
    case 'double': case 'float':
      return 0
    case 'bytes': return ''
    default: return null
  }
}

export function createDefaultValue(field: FieldMeta, visited: Set<string> = new Set()): unknown {
  const singleValue = (): unknown => {
    if (field.kind === 'enum') return field.enumValues?.[0]?.[1] ?? 0
    if (field.kind === 'message' && field.messageType) {
      const typeName = field.messageType.fullName || field.type
      // Prevent infinite recursion for circular references
      if (visited.has(typeName)) {
        return {}
      }
      const newVisited = new Set(visited)
      newVisited.add(typeName)

      const nested: Record<string, unknown> = {}
      for (const f of extractFields(field.messageType)) {
        nested[f.jsonName] = createDefaultValue(f, newVisited)
      }
      return nested
    }
    return getScalarDefault(field.type || 'string')
  }

  if (field.repeated) {
    return [singleValue()]
  }
  return singleValue()
}

export function createEmptyRequest(method: MethodMeta): Record<string, unknown> {
  const req: Record<string, unknown> = {}
  for (const field of method.inputFields) {
    req[field.jsonName] = createDefaultValue(field)
  }
  return req
}

export interface CallResult {
  response: unknown
  error: unknown
  grpcStatus?: number
  grpcMessage?: string
  duration: number
  status: 'success' | 'error'
}

// gRPC status code names
const GRPC_STATUS_NAMES: Record<number, string> = {
  0: 'OK',
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
}

function parseGrpcTrailers(trailerText: string): { status?: number; message?: string } {
  const statusMatch = trailerText.match(/grpc-status:\s*(\d+)/)
  const messageMatch = trailerText.match(/grpc-message:\s*([^\r\n]*)/)
  return {
    status: statusMatch ? parseInt(statusMatch[1], 10) : undefined,
    message: messageMatch ? decodeURIComponent(messageMatch[1]) : undefined,
  }
}

export async function executeCall(
  service: ServiceMeta,
  method: MethodMeta,
  request: Record<string, unknown>,
  baseUrl: string,
  customHeaders?: Record<string, string>
): Promise<CallResult> {
  const start = performance.now()

  try {
    // Encode the request message
    const errMsg = method.inputType.verify(request)
    if (errMsg) {
      return { response: null, error: `Invalid request: ${errMsg}`, duration: 0, status: 'error' }
    }

    const message = method.inputType.create(request)
    const buffer = method.inputType.encode(message).finish()

    // Create grpc-web frame (5 bytes header + message)
    const frame = new Uint8Array(5 + buffer.length)
    frame[0] = 0 // not compressed
    const len = buffer.length
    frame[1] = (len >> 24) & 0xff
    frame[2] = (len >> 16) & 0xff
    frame[3] = (len >> 8) & 0xff
    frame[4] = len & 0xff
    frame.set(buffer, 5)

    // Make gRPC-Web request
    const headers: Record<string, string> = {
      'Content-Type': 'application/grpc-web+proto',
      'Accept': 'application/grpc-web+proto',
      'x-grpc-web': '1',
    }

    // Add custom headers
    if (customHeaders) {
      Object.assign(headers, customHeaders)
    }

    const response = await fetch(`${baseUrl}${method.fullPath}`, {
      method: 'POST',
      headers,
      body: frame,
    })

    if (!response.ok) {
      const text = await response.text()
      return {
        response: null,
        error: `HTTP ${response.status}: ${text}`,
        duration: performance.now() - start,
        status: 'error',
      }
    }

    const responseBuffer = await response.arrayBuffer()
    const responseBytes = new Uint8Array(responseBuffer)

    // Check response headers for gRPC status (some servers send it there)
    const headerGrpcStatus = response.headers.get('grpc-status')
    const headerGrpcMessage = response.headers.get('grpc-message')

    // Parse grpc-web response
    if (responseBytes.length < 5) {
      // Try to get error from headers
      if (headerGrpcStatus && headerGrpcStatus !== '0') {
        const grpcStatus = parseInt(headerGrpcStatus, 10)
        const grpcMessage = headerGrpcMessage ? decodeURIComponent(headerGrpcMessage) : undefined
        const statusName = GRPC_STATUS_NAMES[grpcStatus] || `CODE_${grpcStatus}`
        return {
          response: null,
          error: `${statusName}: ${grpcMessage || 'Unknown error'}`,
          grpcStatus,
          grpcMessage,
          duration: performance.now() - start,
          status: 'error',
        }
      }
      return {
        response: null,
        error: `Empty response (${responseBytes.length} bytes)`,
        duration: performance.now() - start,
        status: 'error',
      }
    }

    // Check for trailers-only response (grpc error)
    if (responseBytes[0] === 0x80) {
      const trailerText = new TextDecoder().decode(responseBytes.slice(5))
      const { status: grpcStatus, message: grpcMessage } = parseGrpcTrailers(trailerText)
      const statusName = grpcStatus !== undefined ? GRPC_STATUS_NAMES[grpcStatus] || `CODE_${grpcStatus}` : 'UNKNOWN'
      return {
        response: null,
        error: `${statusName}: ${grpcMessage || 'Unknown error'}`,
        grpcStatus,
        grpcMessage,
        duration: performance.now() - start,
        status: 'error',
      }
    }

    // Extract message from frame
    const msgLen = (responseBytes[1] << 24) | (responseBytes[2] << 16) | (responseBytes[3] << 8) | responseBytes[4]
    const msgBytes = responseBytes.slice(5, 5 + msgLen)

    // Check for trailers after the message
    const trailerStart = 5 + msgLen
    if (trailerStart < responseBytes.length && responseBytes[trailerStart] === 0x80) {
      const trailerLen = (responseBytes[trailerStart + 1] << 24) | (responseBytes[trailerStart + 2] << 16) |
                         (responseBytes[trailerStart + 3] << 8) | responseBytes[trailerStart + 4]
      const trailerText = new TextDecoder().decode(responseBytes.slice(trailerStart + 5, trailerStart + 5 + trailerLen))
      const { status: grpcStatus, message: grpcMessage } = parseGrpcTrailers(trailerText)

      // If grpc-status is non-zero, it's an error
      if (grpcStatus && grpcStatus !== 0) {
        const statusName = GRPC_STATUS_NAMES[grpcStatus] || `CODE_${grpcStatus}`
        return {
          response: null,
          error: `${statusName}: ${grpcMessage || 'Unknown error'}`,
          grpcStatus,
          grpcMessage,
          duration: performance.now() - start,
          status: 'error',
        }
      }
    }

    // Decode response
    const decoded = method.outputType.decode(msgBytes)
    const responseObj = method.outputType.toObject(decoded, {
      longs: String,
      enums: String,
      defaults: true,
    })

    return {
      response: responseObj,
      error: null,
      duration: performance.now() - start,
      status: 'success',
    }
  } catch (err) {
    // Handle network/connection errors with more detail
    const errorMessage = err instanceof Error ? err.message : String(err)
    let displayError = errorMessage

    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      displayError = `Network Error: Unable to connect to server. Check if the URL is correct and the server is running.`
    } else if (errorMessage.includes('CORS')) {
      displayError = `CORS Error: The server does not allow requests from this origin.`
    }

    return {
      response: null,
      error: displayError,
      duration: performance.now() - start,
      status: 'error',
    }
  }
}
