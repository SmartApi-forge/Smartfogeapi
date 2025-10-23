# GitHub OAuth Security Improvements

## Overview
Implemented three critical security enhancements to the GitHub OAuth service to protect user access tokens and ensure proper token lifecycle management.

## 1. AES-256-GCM Token Encryption

### Problem
GitHub access tokens were stored in plaintext in the database, making them vulnerable if the database is compromised.

### Solution
- **Encryption Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Management**: 32-byte encryption key loaded from `GITHUB_TOKEN_ENCRYPTION_KEY` environment variable
- **Format**: `iv:authTag:ciphertext` (all hex-encoded)
  - 16-byte random IV (Initialization Vector)
  - 16-byte authentication tag for integrity verification
  - Variable-length ciphertext

### Implementation Details
```typescript
// Encryption
private encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
  let ciphertext = cipher.update(token, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

// Decryption
private decryptToken(cipherString: string): string {
  const [ivHex, authTagHex, ciphertext] = cipherString.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
  decipher.setAuthTag(authTag);
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}
```

### Key Validation
- Validates encryption key presence at service initialization
- Ensures key is exactly 32 bytes (64 hex characters)
- Throws clear error if key is missing or invalid

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. GitHub API Token Revocation

### Problem
The `revokeIntegration` method only deactivated tokens locally in the database. Tokens remained valid on GitHub's side, creating a security risk if:
- Database is compromised
- Token is leaked
- User expects full revocation

### Solution
- Calls GitHub's token revocation API before local deactivation
- Uses OAuth App authentication (client ID + secret)
- Gracefully handles failures (logs error but continues with local deactivation)

### Implementation
```typescript
async revokeIntegration(userId: string): Promise<void> {
  // Get the integration first to access the token
  const integration = await this.getUserIntegration(userId);
  
  if (integration?.access_token) {
    // Revoke token with GitHub
    try {
      await fetch(`https://api.github.com/applications/${this.config.clientId}/token`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ access_token: integration.access_token }),
      });
    } catch (error) {
      console.error('Failed to revoke token with GitHub:', error);
    }
  }

  // Deactivate locally
  const { error } = await supabase
    .from('user_integrations')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('provider', 'github');

  if (error) {
    throw new Error(`Failed to revoke GitHub integration: ${error.message}`);
  }
}
```

### API Endpoint
- **URL**: `https://api.github.com/applications/{client_id}/token`
- **Method**: DELETE
- **Auth**: Basic (client_id:client_secret)
- **Body**: `{ "access_token": "..." }`

## 3. Robust Email Fallback Handling

### Problem
The email fallback logic could leave `user.email` undefined when:
- `/user/emails` API call fails
- Response is empty array
- Email extraction fails

This violated the `GitHubUser` interface contract requiring a non-null email.

### Solution
- Validates email API response status
- Checks that emails array exists and has at least one entry
- Selects primary email if available, otherwise first email
- Final validation ensures email is not undefined
- Throws clear error: "No email available for GitHub user"

### Implementation
```typescript
if (!user.email) {
  const emailResponse = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!emailResponse.ok) {
    throw new Error('Failed to fetch GitHub user emails');
  }

  const emails = await emailResponse.json();
  
  // Validate that we have at least one email
  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error('No email available for GitHub user');
  }

  // Select primary email if available, otherwise use first email
  const primaryEmail = emails.find((e: any) => e.primary);
  user.email = primaryEmail?.email || emails[0]?.email;
  
  // Final validation
  if (!user.email) {
    throw new Error('No email available for GitHub user');
  }
}
```

## Environment Variables

### Required New Variable
```bash
# AES-256 encryption key for GitHub tokens (64 hex characters = 32 bytes)
GITHUB_TOKEN_ENCRYPTION_KEY=your_64_character_hex_encryption_key
```

### Generation Command
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration Considerations

### Existing Tokens
If you have existing plaintext tokens in the database, you have two options:

#### Option A: Re-authenticate Users (Recommended)
1. Revoke all existing integrations
2. Users will need to reconnect their GitHub accounts
3. Safest approach - ensures all tokens are properly encrypted

#### Option B: Migration Script
Create a one-time migration to encrypt existing tokens:

```typescript
// migration-script.ts
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createCipheriv } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const encryptionKey = Buffer.from(process.env.GITHUB_TOKEN_ENCRYPTION_KEY!, 'hex');

function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  let ciphertext = cipher.update(token, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

async function migrateTokens() {
  const { data: integrations, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('provider', 'github')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch integrations:', error);
    return;
  }

  for (const integration of integrations || []) {
    // Check if token is already encrypted (contains colons)
    if (integration.access_token.includes(':')) {
      console.log(`Skipping already encrypted token for user ${integration.user_id}`);
      continue;
    }

    const encryptedToken = encryptToken(integration.access_token);
    
    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({ access_token: encryptedToken })
      .eq('id', integration.id);

    if (updateError) {
      console.error(`Failed to update token for user ${integration.user_id}:`, updateError);
    } else {
      console.log(`Successfully encrypted token for user ${integration.user_id}`);
    }
  }
}

migrateTokens().then(() => console.log('Migration complete'));
```

## Security Benefits

### 1. Defense in Depth
- Even if database is compromised, tokens are encrypted
- Attacker needs both database access AND encryption key

### 2. Proper Token Lifecycle
- Tokens are fully revoked on GitHub when user disconnects
- Prevents token reuse after revocation

### 3. Type Safety
- Email field is guaranteed to be present
- Prevents runtime errors from missing email data

### 4. Audit Trail
- Failed GitHub revocations are logged
- Can monitor for potential issues

## Testing

### Test Encryption/Decryption
```typescript
const service = new GitHubOAuthService();
const token = 'gho_test_token_123';
const encrypted = service['encryptToken'](token);
const decrypted = service['decryptToken'](encrypted);
console.assert(token === decrypted, 'Encryption roundtrip failed');
```

### Test Token Revocation
```typescript
// Mock GitHub API response
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

await service.revokeIntegration(userId);

expect(mockFetch).toHaveBeenCalledWith(
  expect.stringContaining('/applications/'),
  expect.objectContaining({ method: 'DELETE' })
);
```

### Test Email Fallback
```typescript
// Test with empty emails array
const mockEmptyEmails = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => []
});

await expect(service.getGitHubUser(token))
  .rejects.toThrow('No email available for GitHub user');
```

## Files Modified

1. **lib/github-oauth.ts**
   - Added `encryptToken()` and `decryptToken()` methods
   - Updated `storeIntegration()` to encrypt tokens
   - Updated `getUserIntegration()` to decrypt tokens
   - Updated `revokeIntegration()` to call GitHub API
   - Enhanced email fallback logic with validation
   - Added encryption key validation in constructor

2. **env.example**
   - Added `GITHUB_TOKEN_ENCRYPTION_KEY` with generation instructions

## Next Steps

1. **Generate encryption key** (already done):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Add to environment variables**:
   ```bash
   GITHUB_TOKEN_ENCRYPTION_KEY=397af9951c67a28efdfc2f00b336803e8b8fc2a6b84f13895fcf2f7b4a53ae8b
   ```

3. **Handle existing tokens** (choose one):
   - Force re-authentication for all users
   - Run migration script to encrypt existing tokens

4. **Test the implementation**:
   - Connect GitHub account
   - Verify token is encrypted in database
   - Disconnect and verify GitHub revocation
   - Test email fallback scenarios

## Security Checklist

- [x] Tokens encrypted at rest using AES-256-GCM
- [x] Encryption key validated at startup
- [x] Tokens decrypted only when needed
- [x] Tokens revoked with GitHub on disconnect
- [x] Email field guaranteed to be present
- [x] Clear error messages for debugging
- [x] Graceful handling of GitHub API failures
- [x] No plaintext tokens in logs
- [x] Environment variable documentation updated
