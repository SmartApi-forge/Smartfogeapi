/**
 * OpenAPI 3.1 Spec Validator Service
 * 
 * Validates OpenAPI 3.1 specifications against the schema requirements.
 * Returns validation errors if the spec is invalid.
 * 
 * Requirements: 3.8
 * Property 8: OpenAPI Spec Validation
 */

import type { OpenAPISpec, OpenAPIPathItem, OpenAPIOperation, SchemaDefinition } from './openapi-generator';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: ValidationErrorCode;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: ValidationWarningCode;
}

export type ValidationErrorCode =
  | 'INVALID_YAML'
  | 'INVALID_JSON'
  | 'MISSING_OPENAPI_VERSION'
  | 'INVALID_OPENAPI_VERSION'
  | 'MISSING_INFO'
  | 'MISSING_INFO_TITLE'
  | 'MISSING_INFO_VERSION'
  | 'MISSING_PATHS'
  | 'EMPTY_PATHS'
  | 'INVALID_PATH_FORMAT'
  | 'MISSING_OPERATION_RESPONSES'
  | 'INVALID_HTTP_METHOD'
  | 'INVALID_STATUS_CODE'
  | 'MISSING_RESPONSE_DESCRIPTION'
  | 'INVALID_SCHEMA_REF'
  | 'MISSING_REQUIRED_PARAMETER';

export type ValidationWarningCode =
  | 'MISSING_DESCRIPTION'
  | 'MISSING_SERVERS'
  | 'MISSING_TAGS'
  | 'MISSING_SECURITY_SCHEMES'
  | 'MISSING_EXAMPLES'
  | 'MISSING_OPERATION_ID'
  | 'DEPRECATED_FEATURE';

// Valid HTTP methods in OpenAPI 3.1
const VALID_HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

// Valid HTTP status codes
const VALID_STATUS_CODES = [
  '100', '101', '102', '103',
  '200', '201', '202', '203', '204', '205', '206', '207', '208', '226',
  '300', '301', '302', '303', '304', '305', '307', '308',
  '400', '401', '402', '403', '404', '405', '406', '407', '408', '409',
  '410', '411', '412', '413', '414', '415', '416', '417', '418', '421',
  '422', '423', '424', '425', '426', '428', '429', '431', '451',
  '500', '501', '502', '503', '504', '505', '506', '507', '508', '510', '511',
  'default', '1XX', '2XX', '3XX', '4XX', '5XX'
];

// =============================================================================
// YAML/JSON Parser
// =============================================================================

/**
 * Simple YAML parser for OpenAPI specs
 * Handles basic YAML structures used in OpenAPI
 */
function parseYAML(yamlString: string): unknown {
  // Try JSON first (valid YAML is often valid JSON)
  try {
    return JSON.parse(yamlString);
  } catch {
    // Continue with YAML parsing
  }

  const lines = yamlString.split('\n');
  const result: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: -1 }];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Calculate indentation
    const indent = line.search(/\S/);
    
    // Handle key-value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = trimmed.substring(0, colonIndex).trim();
    let value: unknown = trimmed.substring(colonIndex + 1).trim();
    
    // Pop stack to find correct parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].obj;
    
    // Parse value
    if (value === '' || value === null) {
      // Nested object
      const newObj: Record<string, unknown> = {};
      parent[key] = newObj;
      stack.push({ obj: newObj, indent });
    } else {
      // Scalar value
      parent[key] = parseYAMLValue(value as string);
    }
  }
  
  return result;
}

/**
 * Parse a YAML scalar value
 */
function parseYAMLValue(value: string): unknown {
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // Boolean
  if (value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === 'no' || value === 'off') return false;
  
  // Null
  if (value === 'null' || value === '~' || value === '') return null;
  
  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  
  // String
  return value;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate an OpenAPI 3.1 specification
 * 
 * @param spec - The OpenAPI spec as a string (YAML or JSON) or parsed object
 * @returns ValidationResult with valid flag, errors, and warnings
 */
export function validateOpenAPISpec(spec: string | OpenAPISpec): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  let parsed: OpenAPISpec;
  
  // Parse if string
  if (typeof spec === 'string') {
    try {
      // Try JSON first
      parsed = JSON.parse(spec) as OpenAPISpec;
    } catch {
      try {
        // Try YAML
        parsed = parseYAML(spec) as OpenAPISpec;
      } catch {
        return {
          valid: false,
          errors: [{
            path: '',
            message: 'Invalid YAML or JSON syntax',
            code: 'INVALID_YAML'
          }],
          warnings: []
        };
      }
    }
  } else {
    parsed = spec;
  }

  // Validate OpenAPI version
  validateOpenAPIVersion(parsed, errors);
  
  // Validate info section
  validateInfo(parsed, errors, warnings);
  
  // Validate servers (optional but recommended)
  validateServers(parsed, warnings);
  
  // Validate paths
  validatePaths(parsed, errors, warnings);
  
  // Validate components
  validateComponents(parsed, errors, warnings);
  
  // Validate security
  validateSecurity(parsed, warnings);
  
  // Validate tags
  validateTags(parsed, warnings);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate the OpenAPI version field
 */
function validateOpenAPIVersion(
  spec: OpenAPISpec,
  errors: ValidationError[]
): void {
  if (!spec.openapi) {
    errors.push({
      path: 'openapi',
      message: 'Missing required field: openapi',
      code: 'MISSING_OPENAPI_VERSION'
    });
    return;
  }
  
  // OpenAPI 3.1.x validation
  if (!spec.openapi.startsWith('3.1')) {
    errors.push({
      path: 'openapi',
      message: `Invalid OpenAPI version: ${spec.openapi}. Must be 3.1.x`,
      code: 'INVALID_OPENAPI_VERSION'
    });
  }
}

/**
 * Validate the info section
 */
function validateInfo(
  spec: OpenAPISpec,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!spec.info) {
    errors.push({
      path: 'info',
      message: 'Missing required field: info',
      code: 'MISSING_INFO'
    });
    return;
  }
  
  if (!spec.info.title) {
    errors.push({
      path: 'info.title',
      message: 'Missing required field: info.title',
      code: 'MISSING_INFO_TITLE'
    });
  }
  
  if (!spec.info.version) {
    errors.push({
      path: 'info.version',
      message: 'Missing required field: info.version',
      code: 'MISSING_INFO_VERSION'
    });
  }
  
  if (!spec.info.description) {
    warnings.push({
      path: 'info.description',
      message: 'Missing recommended field: info.description',
      code: 'MISSING_DESCRIPTION'
    });
  }
}

/**
 * Validate the servers section
 */
function validateServers(
  spec: OpenAPISpec,
  warnings: ValidationWarning[]
): void {
  if (!spec.servers || spec.servers.length === 0) {
    warnings.push({
      path: 'servers',
      message: 'Missing recommended field: servers',
      code: 'MISSING_SERVERS'
    });
  }
}

/**
 * Validate the paths section
 */
function validatePaths(
  spec: OpenAPISpec,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!spec.paths) {
    errors.push({
      path: 'paths',
      message: 'Missing required field: paths',
      code: 'MISSING_PATHS'
    });
    return;
  }
  
  const pathKeys = Object.keys(spec.paths);
  if (pathKeys.length === 0) {
    errors.push({
      path: 'paths',
      message: 'paths must contain at least one endpoint',
      code: 'EMPTY_PATHS'
    });
    return;
  }
  
  // Validate each path
  for (const pathKey of pathKeys) {
    // Path must start with /
    if (!pathKey.startsWith('/')) {
      errors.push({
        path: `paths.${pathKey}`,
        message: `Path must start with /: ${pathKey}`,
        code: 'INVALID_PATH_FORMAT'
      });
    }
    
    const pathItem = spec.paths[pathKey];
    validatePathItem(pathKey, pathItem, errors, warnings);
  }
}

/**
 * Validate a path item (all operations for a path)
 */
function validatePathItem(
  pathKey: string,
  pathItem: OpenAPIPathItem,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check each HTTP method
  for (const method of VALID_HTTP_METHODS) {
    const operation = pathItem[method];
    if (operation) {
      validateOperation(`paths.${pathKey}.${method}`, operation, errors, warnings);
    }
  }
  
  // Check for invalid methods
  for (const key of Object.keys(pathItem)) {
    if (!VALID_HTTP_METHODS.includes(key as typeof VALID_HTTP_METHODS[number]) &&
        !['summary', 'description', 'parameters', 'servers', '$ref'].includes(key)) {
      errors.push({
        path: `paths.${pathKey}.${key}`,
        message: `Invalid HTTP method: ${key}`,
        code: 'INVALID_HTTP_METHOD'
      });
    }
  }
}

/**
 * Validate an operation (GET, POST, etc.)
 */
function validateOperation(
  path: string,
  operation: OpenAPIOperation,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Responses is required
  if (!operation.responses || Object.keys(operation.responses).length === 0) {
    errors.push({
      path: `${path}.responses`,
      message: 'Missing required field: responses',
      code: 'MISSING_OPERATION_RESPONSES'
    });
  } else {
    // Validate each response
    for (const statusCode of Object.keys(operation.responses)) {
      if (!VALID_STATUS_CODES.includes(statusCode)) {
        errors.push({
          path: `${path}.responses.${statusCode}`,
          message: `Invalid status code: ${statusCode}`,
          code: 'INVALID_STATUS_CODE'
        });
      }
      
      const response = operation.responses[statusCode];
      if (!response.description) {
        errors.push({
          path: `${path}.responses.${statusCode}.description`,
          message: 'Missing required field: description',
          code: 'MISSING_RESPONSE_DESCRIPTION'
        });
      }
    }
  }
  
  // operationId is recommended
  if (!operation.operationId) {
    warnings.push({
      path: `${path}.operationId`,
      message: 'Missing recommended field: operationId',
      code: 'MISSING_OPERATION_ID'
    });
  }
  
  // Validate parameters if present
  if (operation.parameters) {
    for (let i = 0; i < operation.parameters.length; i++) {
      const param = operation.parameters[i];
      if (param.in === 'path' && !param.required) {
        errors.push({
          path: `${path}.parameters[${i}]`,
          message: `Path parameter "${param.name}" must have required: true`,
          code: 'MISSING_REQUIRED_PARAMETER'
        });
      }
    }
  }
}

/**
 * Validate the components section
 */
function validateComponents(
  spec: OpenAPISpec,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!spec.components) {
    return; // Components is optional
  }
  
  // Validate schema references
  if (spec.components.schemas) {
    validateSchemaRefs(spec, errors);
  }
  
  // Check for security schemes if security is used
  if (spec.security && spec.security.length > 0) {
    if (!spec.components.securitySchemes || Object.keys(spec.components.securitySchemes).length === 0) {
      warnings.push({
        path: 'components.securitySchemes',
        message: 'Security is defined but no security schemes are provided',
        code: 'MISSING_SECURITY_SCHEMES'
      });
    }
  }
}

/**
 * Validate schema references ($ref)
 */
function validateSchemaRefs(
  spec: OpenAPISpec,
  errors: ValidationError[]
): void {
  const definedSchemas = new Set(Object.keys(spec.components?.schemas || {}));
  
  // Find all $ref usages and validate they exist
  const refs = findAllRefs(spec);
  
  for (const ref of refs) {
    // Parse the $ref path
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.replace('#/components/schemas/', '');
      if (!definedSchemas.has(schemaName)) {
        errors.push({
          path: ref,
          message: `Referenced schema not found: ${schemaName}`,
          code: 'INVALID_SCHEMA_REF'
        });
      }
    }
  }
}

/**
 * Find all $ref values in an object recursively
 */
function findAllRefs(obj: unknown, refs: string[] = []): string[] {
  if (obj === null || obj === undefined) {
    return refs;
  }
  
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        findAllRefs(item, refs);
      }
    } else {
      const record = obj as Record<string, unknown>;
      if ('$ref' in record && typeof record.$ref === 'string') {
        refs.push(record.$ref);
      }
      for (const value of Object.values(record)) {
        findAllRefs(value, refs);
      }
    }
  }
  
  return refs;
}

/**
 * Validate security definitions
 */
function validateSecurity(
  spec: OpenAPISpec,
  warnings: ValidationWarning[]
): void {
  // Security is optional, but if defined, check it's valid
  if (spec.security && spec.security.length > 0) {
    const definedSchemes = new Set(Object.keys(spec.components?.securitySchemes || {}));
    
    for (const securityReq of spec.security) {
      for (const schemeName of Object.keys(securityReq)) {
        if (!definedSchemes.has(schemeName)) {
          warnings.push({
            path: `security.${schemeName}`,
            message: `Security scheme not defined: ${schemeName}`,
            code: 'MISSING_SECURITY_SCHEMES'
          });
        }
      }
    }
  }
}

/**
 * Validate tags
 */
function validateTags(
  spec: OpenAPISpec,
  warnings: ValidationWarning[]
): void {
  if (!spec.tags || spec.tags.length === 0) {
    warnings.push({
      path: 'tags',
      message: 'Missing recommended field: tags',
      code: 'MISSING_TAGS'
    });
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick validation check - returns true if valid, false otherwise
 * 
 * @param spec - The OpenAPI spec to validate
 * @returns boolean indicating if the spec is valid
 */
export function isValidOpenAPISpec(spec: string | OpenAPISpec): boolean {
  return validateOpenAPISpec(spec).valid;
}

/**
 * Get only the error messages from validation
 * 
 * @param spec - The OpenAPI spec to validate
 * @returns Array of error message strings
 */
export function getValidationErrors(spec: string | OpenAPISpec): string[] {
  const result = validateOpenAPISpec(spec);
  return result.errors.map(e => `${e.path}: ${e.message}`);
}

/**
 * Validate and throw if invalid
 * 
 * @param spec - The OpenAPI spec to validate
 * @throws Error if the spec is invalid
 */
export function assertValidOpenAPISpec(spec: string | OpenAPISpec): void {
  const result = validateOpenAPISpec(spec);
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `  - ${e.path}: ${e.message}`).join('\n');
    throw new Error(`Invalid OpenAPI spec:\n${errorMessages}`);
  }
}

/**
 * Format validation result as a human-readable string
 * 
 * @param result - The validation result
 * @returns Formatted string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.valid) {
    lines.push('✓ OpenAPI spec is valid');
  } else {
    lines.push('✗ OpenAPI spec is invalid');
  }
  
  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of result.errors) {
      lines.push(`  ✗ [${error.code}] ${error.path}: ${error.message}`);
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠ [${warning.code}] ${warning.path}: ${warning.message}`);
    }
  }
  
  return lines.join('\n');
}
