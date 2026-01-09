# GX UI Architecture

## Overview

GX UI is a generic gRPC client that dynamically parses `.proto` files at runtime. Unlike compile-time code generators (protoc, protobuf-ts), it doesn't generate any files - everything happens in memory.

## How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Select Proto   │────▶│   Parse &    │────▶│  Display in UI  │
│   Directory     │     │   Extract    │     │  (Services &    │
│                 │     │   Schema     │     │   Methods)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  gRPC-Web       │◀────│   Encode     │◀────│  User Edits     │
│  Response       │     │   Request    │     │  JSON Request   │
└─────────────────┘     └──────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Decode &       │
│  Display Result │
└─────────────────┘
```

## Step-by-Step Process

### 1. Load Proto Files

When you select a directory:

```typescript
// Recursively read all .proto files from directory
const protoFiles = await readProtoFilesRecursive(dirPath)
// Returns: [{ filename: "user.proto", content: "syntax = \"proto3\"..." }]
```

### 2. Parse with Protobufjs

Proto content is parsed into an in-memory schema:

```typescript
import { Root } from 'protobufjs'

const root = new Root()

// Add Google well-known types (Timestamp, Duration, etc.)
addGoogleTypes(root)

// Parse each proto file
for (const file of protoFiles) {
  protobuf.parse(file.content, root, { keepCase: true })
}
```

### 3. Extract Services & Methods

Walk the parsed namespace tree to find services:

```typescript
function extractServices(namespace: Namespace): ServiceMeta[] {
  const services: ServiceMeta[] = []

  for (const nested of Object.values(namespace.nested || {})) {
    if (nested instanceof Service) {
      services.push({
        fullName: nested.fullName,
        shortName: nested.name,
        methods: extractMethods(nested)
      })
    }
    // Recurse into nested namespaces
    if (nested instanceof Namespace) {
      services.push(...extractServices(nested))
    }
  }

  return services
}
```

### 4. Generate Request Templates

For each method, create a default JSON request based on field types:

```typescript
function createEmptyRequest(method: MethodMeta): object {
  const fields = method.inputType.fields
  const request = {}

  for (const field of fields) {
    request[field.name] = getDefaultValue(field)
    // string → ""
    // int32 → 0
    // bool → false
    // message → { ...nested fields }
    // repeated → []
  }

  return request
}
```

### 5. Execute gRPC-Web Calls

When user clicks Execute:

```typescript
async function executeCall(service, method, requestData, baseUrl, authToken) {
  // 1. Encode request to protobuf binary
  const inputType = root.lookupType(method.inputType.fullName)
  const message = inputType.create(requestData)
  const binary = inputType.encode(message).finish()

  // 2. Frame for gRPC-Web (5-byte header + data)
  const frame = new Uint8Array(5 + binary.length)
  frame[0] = 0  // not compressed
  frame[1] = (binary.length >> 24) & 0xff
  frame[2] = (binary.length >> 16) & 0xff
  frame[3] = (binary.length >> 8) & 0xff
  frame[4] = binary.length & 0xff
  frame.set(binary, 5)

  // 3. Send HTTP POST request
  const response = await fetch(`${baseUrl}/${service.fullName}/${method.name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web+proto',
      'Authorization': authToken ? `Bearer ${authToken}` : undefined
    },
    body: frame
  })

  // 4. Decode response
  const outputType = root.lookupType(method.outputType.fullName)
  const responseData = await response.arrayBuffer()
  const decoded = outputType.decode(new Uint8Array(responseData).slice(5))

  return outputType.toObject(decoded)
}
```

## Key Components

### `proto-loader.ts`

Core module handling:
- Proto file parsing
- Google well-known types (Timestamp, Duration, Struct, etc.)
- Service/method extraction
- Request template generation
- gRPC-Web encoding/decoding
- Circular reference detection (for self-referencing types like `Value`)

### `App.tsx`

UI component handling:
- Directory selection (Tauri or browser File System Access API)
- Service/method navigation
- Request editing
- Response display
- Method caching (remembers request/response per endpoint)
- Dirty state tracking (red dot indicator)

## Memory-Only Design

**No files are generated or saved:**

| Compile-time (protoc) | Runtime (GX UI) |
|----------------------|-----------------|
| Generate `.ts` files | Parse in memory |
| Commit to repo | Nothing to commit |
| Rebuild on proto change | Just reload directory |
| Type-safe at compile time | Dynamic at runtime |

**Benefits:**
- Works with any proto files without setup
- No build step needed
- Easy to switch between different proto sets
- Great for exploration and debugging

**Trade-offs:**
- No compile-time type checking
- Slightly slower (parsing at runtime)
- Schema lost when app closes

## Supported Types

### Scalars
- `string`, `bytes`
- `int32`, `int64`, `uint32`, `uint64`, `sint32`, `sint64`
- `fixed32`, `fixed64`, `sfixed32`, `sfixed64`
- `float`, `double`
- `bool`

### Complex Types
- `message` (nested messages)
- `enum`
- `repeated` (arrays)
- `map` (key-value maps)
- `oneof` (union types)

### Google Well-Known Types
- `google.protobuf.Timestamp`
- `google.protobuf.Duration`
- `google.protobuf.Empty`
- `google.protobuf.Any`
- `google.protobuf.Struct`
- `google.protobuf.Value`
- `google.protobuf.ListValue`
- `google.protobuf.StringValue`, `Int32Value`, `BoolValue`, etc.
