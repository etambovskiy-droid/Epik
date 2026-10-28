# Firestore Security Specification (`security_spec.md`)

## 1. Access Control Matrix
| Path | Create | Read (get/list) | Update | Delete | Ownership / Role Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | Owner (`request.auth.uid == userId`) | Owner or Admin | Owner (cannot escalate `role` to `admin` unless already admin) | Admin only | Document ID must equal `uid`. Immutable `uid`, `email`, `createdAt`. |
| `/sessions/{sessionId}` | Authenticated Owner (`request.resource.data.uid == request.auth.uid`) | Owner (`resource.data.uid == request.auth.uid`) or Admin | Owner (`resource.data.uid == request.auth.uid`, immutable `uid`, `id`, `createdAt`) | Owner or Admin | `sessionId` must match `id` and `isValidId`. |
| `/images/{imageId}` | Authenticated Owner (`request.resource.data.uid == request.auth.uid`) | Owner (`resource.data.uid == request.auth.uid`) or Admin | Owner (`resource.data.uid == request.auth.uid`, immutable `uid`, `id`, `createdAt`) | Owner or Admin | `imageId` must match `id` and `isValidId`. |
| `/messages/{messageId}` | Authenticated Owner (`request.resource.data.uid == request.auth.uid`) | Owner (`resource.data.uid == request.auth.uid`) or Admin | Deny (messages are append-only) | Owner or Admin | `messageId` must match `id` and `isValidId`. |

## 2. Schema & Validation Constraints
- **UserProfile**:
  - `uid`: string, `1..128` chars, equals `userId` and `request.auth.uid`
  - `email`: valid email string, `<= 254` chars
  - `name`: string, `1..120` chars
  - `shopName`: string, `1..150` chars
  - `sellerCode`: string, `1..50` chars
  - `role`: `'seller'` | `'manager'` | `'admin'` (non-admins can only self-assign `'seller'`)
  - `avatarUrl` (optional): string, `<= 2048` chars
  - `createdAt`, `updatedAt`: `timestamp`, `<= request.time`
- **CatalogSession**:
  - `id`: valid ID (`1..128` chars), equals `sessionId`
  - `uid`: string, equals `request.auth.uid`
  - `workspaceId`: string, `1..100` chars
  - `filename`: string, `1..255` chars
  - `categoryTitle`: string, `1..200` chars
  - `productsCount`, `mandatoryColumnsCount`, `newlyFilledCount`, `unfilledMandatoryCount`: int `>= 0` and `<= 100000`
  - `fillRatePercentage`: number `0..100`
  - `createdAt`: `timestamp`, `<= request.time`
- **GeneratedImage**:
  - `id`: valid ID (`1..128` chars), equals `imageId`
  - `uid`: string, equals `request.auth.uid`
  - `prompt`: string, `1..2000` chars
  - `aspectRatio`: `'1:1'` | `'3:4'` | `'4:3'` | `'9:16'` | `'16:9'`
  - `imageSize`: `'512px'` | `'1K'` | `'2K'` | `'4K'`
  - `imageUrl`: string, `1..900000` chars (supports base64 data URLs up to ~850KB or HTTPS URLs)
  - `productTitle`: string, `0..300` chars
  - `createdAt`: `timestamp`, `<= request.time`
- **ChatMessage**:
  - `id`: valid ID (`1..128` chars), equals `messageId`
  - `uid`: string, equals `request.auth.uid`
  - `role`: `'user'` | `'model'`
  - `text`: string, `1..20000` chars
  - `model`: string, `1..100` chars
  - `createdAt`: `timestamp`, `<= request.time`
