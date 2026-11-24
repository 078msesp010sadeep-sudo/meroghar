# Security Specification & Threat Model: Nepali Home (KinHome)

## 1. Data Invariants
1. **User Identity & Isolation**: A user can only write their own user profile document (`users/{userId}` where `userId == request.auth.uid`). Profile role updates require valid permissions.
2. **Maintenance Tickets**: A tenant can create a maintenance ticket with `tenantId == request.auth.uid`. A landlord or ticket owner can update status and notes.
3. **Sub-Meter Readings & Invoices**: Landlords / houseowners manage official billing records. Invoices can be marked as paid by the respective tenant with valid payment confirmation references.
4. **Chat & Community Messages**: Messages must have `senderId == request.auth.uid` and valid content bounds (length <= 5000 characters).
5. **Water Quality & Environmental Science**: Lab tests must have valid scientific measurement ranges and require authentication for creation.

## 2. The "Dirty Dozen" Threat Payloads
1. **Payload 1 (Identity Spoofing in User Profile)**: Attempt to create `users/victim-123` with `request.auth.uid == "attacker-456"`. Expected: REJECTED (PERMISSION_DENIED).
2. **Payload 2 (Shadow Keys Injection)**: Attempt to inject `isAdmin: true` into `users/{uid}`. Expected: REJECTED.
3. **Payload 3 (Arbitrary Unit Bill Forgery)**: Unauthenticated user attempting to forge invoices in `invoices/{invoiceId}`. Expected: REJECTED.
4. **Payload 4 (Denial of Wallet String Injection)**: Attempt to post ticket description of size 1,000,000 characters. Expected: REJECTED (`size() <= 4000`).
5. **Payload 5 (ID Path Poisoning)**: Document path containing malicious characters `users/../../admin`. Expected: REJECTED (`isValidId()`).
6. **Payload 6 (Terminal Invoice State Tampering)**: Modifying totalDue or unitId on a settled/paid invoice. Expected: REJECTED.
7. **Payload 7 (Unauthenticated Maintenance Ticket Submission)**: Anonymous write to `maintenance_tickets/{ticketId}`. Expected: REJECTED.
8. **Payload 8 (Impersonating Notice Board Author)**: Creating notice with fake landlord credentials. Expected: REJECTED.
9. **Payload 9 (Grocery Order Total Price Hack)**: Altering final settled amounts on delivered grocery orders. Expected: REJECTED.
10. **Payload 10 (Chat Message Impersonation)**: Setting `senderId` to another resident's UID. Expected: REJECTED.
11. **Payload 11 (Blanket Database Dump)**: Unauthenticated collection list queries without filters. Expected: REJECTED.
12. **Payload 12 (Cross-Tenant Bill Deletion)**: Tenant attempting to delete houseowner utility invoices. Expected: REJECTED.
