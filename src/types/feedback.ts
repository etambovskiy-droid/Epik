/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported feedback categories for PIM errors, mapping, and UX.
 */
export type FeedbackType =
  | 'mapping_error'
  | 'validation_bug'
  | 'missing_value'
  | 'ui_issue'
  | 'feature_request';

/**
 * Contextual snapshot captured automatically at the moment of report creation
 * from the targeted cell and related catalog metadata.
 */
export interface ContextSnapshot {
  categoryId: string;
  categoryName: string;
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  attributeId?: string;
  rawValue: string | number | null | undefined;
  parsedValue: string | number | null | undefined;
  allowedValuesSample?: string[];
  errorMessage?: string;
  apiErrorLog?: string;
}

/**
 * Full feedback payload submitted to the API/database.
 */
export interface FeedbackPayload {
  id: string;
  userId: string;
  userRole: 'merchant' | 'category_manager';
  type: FeedbackType;
  comment: string;
  context: ContextSnapshot;
  status: 'new' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
}

/**
 * Standard JSON Schema (Draft-07) for database validation (e.g., Supabase / PostgreSQL check,
 * Firebase Cloud Function validator, or Ajv schema check).
 */
export const FEEDBACK_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'FeedbackPayload',
  description: 'Schema for contextual cell-level feedback submissions in the PIM platform.',
  type: 'object',
  required: ['id', 'userId', 'userRole', 'type', 'comment', 'context', 'status', 'createdAt'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      description: 'Unique UUID v4 or ULID identifier of the feedback report.',
      pattern: '^[a-zA-Z0-9_-]{8,64}$'
    },
    userId: {
      type: 'string',
      description: 'Identifier of the user (merchant ID or KM account ID).',
      minLength: 1,
      maxLength: 128
    },
    userRole: {
      type: 'string',
      description: 'Role of the reporter.',
      enum: ['merchant', 'category_manager']
    },
    type: {
      type: 'string',
      description: 'Classification category of the feedback issue.',
      enum: [
        'mapping_error',
        'validation_bug',
        'missing_value',
        'ui_issue',
        'feature_request'
      ]
    },
    comment: {
      type: 'string',
      description: 'User commentary or issue explanation.',
      minLength: 3,
      maxLength: 2500
    },
    status: {
      type: 'string',
      description: 'Lifecycle status of the ticket.',
      enum: ['new', 'investigating', 'resolved', 'dismissed'],
      default: 'new'
    },
    createdAt: {
      type: 'string',
      description: 'ISO 8601 UTC timestamp of creation.',
      format: 'date-time'
    },
    context: {
      type: 'object',
      description: 'Captured environment and cell snapshot.',
      required: ['categoryId', 'categoryName', 'rowIndex', 'columnIndex', 'columnName'],
      additionalProperties: false,
      properties: {
        categoryId: {
          type: 'string',
          description: 'Unique Epicentr / Catalog category code.'
        },
        categoryName: {
          type: 'string',
          description: 'Human-readable category title.'
        },
        rowIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Zero-based row index in the dataset.'
        },
        columnIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Zero-based column index in the dataset.'
        },
        columnName: {
          type: 'string',
          description: 'Name/header of the targeted column.'
        },
        attributeId: {
          type: ['string', 'null'],
          description: 'Targeted PIM attribute code if known.'
        },
        rawValue: {
          type: ['string', 'number', 'null'],
          description: 'Raw source value before AI processing.'
        },
        parsedValue: {
          type: ['string', 'number', 'null'],
          description: 'Result value proposed or normalized by AI/rules.'
        },
        allowedValuesSample: {
          type: 'array',
          description: 'Subset of valid options from Epicentr directory (max 15 items).',
          items: {
            type: 'string'
          },
          maxItems: 15
        },
        errorMessage: {
          type: ['string', 'null'],
          description: 'Validation error text or moderation refusal reason.'
        },
        apiErrorLog: {
          type: ['string', 'null'],
          description: 'Technical API error or HTTP response snippet.'
        }
      }
    }
  }
} as const;
