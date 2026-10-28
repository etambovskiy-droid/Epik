/**
 * Conceptual unit test suite for Firestore Security Rules
 * Covers positive and negative scenarios for /users, /sessions, /images, and /messages.
 */

export const firestoreRulesTestScenarios = [
  {
    collection: 'users',
    positive: [
      'Authenticated owner can create their own profile with role == "seller" and valid timestamps',
      'Authenticated owner can read and update their own shopName and name while preserving uid, email, role, createdAt'
    ],
    negative: [
      'Unauthenticated user cannot read or write /users/{userId}',
      'Authenticated user cannot create a profile with role == "admin" unless bootstrap admin email',
      'Authenticated user cannot modify another user profile or inject undeclared fields'
    ]
  },
  {
    collection: 'sessions',
    positive: [
      'Authenticated user can create a CatalogSession where uid == request.auth.uid and id == sessionId',
      'Authenticated user can list and read only sessions where resource.data.uid == request.auth.uid'
    ],
    negative: [
      'Authenticated user cannot read sessions belonging to another uid',
      'Authenticated user cannot create a session with fillRatePercentage > 100 or negative counts'
    ]
  },
  {
    collection: 'images',
    positive: [
      'Authenticated user can create and delete their own GeneratedImage documents'
    ],
    negative: [
      'Authenticated user cannot reassign uid on update or exceed prompt length limits'
    ]
  },
  {
    collection: 'messages',
    positive: [
      'Authenticated user can create and read their own ChatMessage documents'
    ],
    negative: [
      'Authenticated user cannot update an existing ChatMessage (append-only history)',
      'Authenticated user cannot read another user ChatMessage documents'
    ]
  }
];
