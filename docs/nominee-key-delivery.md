# Nominee Key Part C Delivery

This document describes how Nominee Key Part C is delivered to nominees in the LifeVault application.

## Current Implementation (MVP)

### Option 1: Encrypted Email Delivery ✅

**Status:** Implemented

**How it works:**
1. User adds a nominee and provides:
   - Nominee contact information (email/phone)
   - An encryption password (shared separately with nominee via secure channel)
2. System generates Part C using Shamir Secret Sharing (2-of-3)
3. Part C is encrypted with the user-provided password using AES-256-GCM
4. Encrypted Part C is:
   - Stored in the database (encrypted)
   - Included in the notification email to the nominee (if `notifyNominee` is enabled)
5. User shares the decryption password with nominee through a separate secure channel (phone, in person, etc.)
6. Nominee can decrypt Part C when needed using the shared password

**Security Features:**
- Part C is encrypted before storage (not stored in plaintext)
- Encryption password is never stored or sent via email
- User must share password through a separate secure channel
- Email contains encrypted Part C only

**Limitations:**
- Requires user to manually share password through another channel
- Email delivery may not be suitable for all use cases
- Nominee must securely store both encrypted Part C and decryption password

## Future Enhancement Options

### Option 2: Secure Download Link with Time-Limited Access

**Description:**
Generate a time-limited, one-time-use download link for Part C. The link expires after a set period (e.g., 7 days) and can only be accessed once.

**Implementation:**
1. Generate a unique token for Part C download
2. Store token with expiration time and one-time-use flag
3. Send email/SMS with secure download link
4. Nominee clicks link → downloads encrypted Part C
5. Link expires after first use or time limit

**Advantages:**
- No need to include encrypted data in email body
- Time-limited access reduces risk
- One-time use prevents replay attacks
- Better for large key sizes

**Considerations:**
- Requires secure token storage
- Need to handle link expiration gracefully
- May require additional infrastructure for secure file hosting

### Option 3: QR Code + Physical Delivery

**Description:**
Generate a QR code containing encrypted Part C. User prints/downloads QR code and delivers it physically to the nominee.

**Implementation:**
1. Generate encrypted Part C
2. Create QR code containing encrypted Part C
3. User downloads/prints QR code
4. User delivers QR code to nominee in person or via secure courier
5. Nominee scans QR code to retrieve encrypted Part C
6. Nominee decrypts using password shared separately

**Advantages:**
- No digital transmission of sensitive data
- Physical delivery adds security layer
- Works offline
- Nominee can store QR code physically

**Considerations:**
- Requires physical delivery mechanism
- QR code must be stored securely
- Not suitable for remote nominees
- May require additional mobile app for scanning

### Option 4: Hardware Security Module (HSM) Integration

**Description:**
Use a Hardware Security Module to generate and securely store Part C. Nominee receives a secure token or certificate.

**Implementation:**
1. Integrate with HSM service (e.g., AWS CloudHSM, Azure Key Vault)
2. Generate Part C within HSM
3. HSM encrypts Part C with nominee's public key
4. Nominee receives encrypted Part C via secure channel
5. Nominee decrypts using their private key

**Advantages:**
- Highest level of security
- Hardware-backed encryption
- No password sharing required
- Industry-standard security practices

**Considerations:**
- Requires HSM infrastructure
- Higher cost
- More complex implementation
- May require nominee to have public/private key pair

### Option 5: Multi-Channel Delivery with Verification

**Description:**
Deliver Part C through multiple channels (email + SMS + secure link) and require nominee to verify receipt through at least one channel.

**Implementation:**
1. Generate encrypted Part C
2. Send encrypted Part C via:
   - Email (encrypted attachment)
   - SMS (encrypted link)
   - Secure download portal (with authentication)
3. Nominee must verify receipt through at least one channel
4. System tracks delivery confirmation
5. User is notified when nominee confirms receipt

**Advantages:**
- Redundancy ensures delivery
- Multiple verification points
- Better user experience
- Audit trail of delivery

**Considerations:**
- More complex implementation
- Requires multiple communication channels
- Higher infrastructure costs
- Need to handle partial delivery scenarios

### Option 6: Split Knowledge with Multiple Nominees

**Description:**
Split Part C further using additional Shamir Secret Sharing. Require multiple nominees to combine their parts to reconstruct Part C.

**Implementation:**
1. Generate Part C using Shamir Secret Sharing
2. Split Part C again into N parts (e.g., 3-of-5)
3. Distribute parts to multiple nominees
4. Require threshold number of nominees to combine parts
5. Reconstruct Part C from combined parts

**Advantages:**
- Additional security layer
- No single point of failure
- Distributed trust model
- Suitable for high-security scenarios

**Considerations:**
- More complex key management
- Requires coordination between nominees
- May delay access in emergency situations
- Higher operational complexity

## Security Best Practices

Regardless of delivery method, follow these practices:

1. **Never store decryption passwords** - Always require separate secure channel
2. **Encrypt Part C before storage** - Never store in plaintext
3. **Use strong encryption** - AES-256-GCM or equivalent
4. **Implement access controls** - Limit who can view/modify nominee records
5. **Audit logging** - Track all nominee-related operations
6. **Time-limited access** - Expire links/tokens after reasonable time
7. **User education** - Guide users on secure password sharing practices

## Recommendations

**For MVP (Current):**
- ✅ Option 1 (Encrypted Email) - Simple, secure, works for most use cases

**For Production (Future):**
- Consider Option 2 (Secure Download Link) for better UX
- Add Option 3 (QR Code) for high-security scenarios
- Implement Option 5 (Multi-Channel) for critical accounts

**For Enterprise:**
- Option 4 (HSM Integration) for maximum security
- Option 6 (Split Knowledge) for high-value accounts

## Implementation Notes

When implementing future options:
1. Maintain backward compatibility with existing nominees
2. Allow users to choose delivery method per nominee
3. Provide clear instructions for each method
4. Implement proper error handling and retry mechanisms
5. Add monitoring and alerting for delivery failures


