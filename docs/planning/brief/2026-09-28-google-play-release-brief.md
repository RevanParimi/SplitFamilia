# Owner's brief — Google Play release (2026-09-28 IST)

The owner pasted this brief in the planning chat on 2026-09-28 (IST). It is kept here verbatim
because chat history is not project memory. Stories SF-001 onward trace back to its stages.
Where the brief assumes something the repository does not have (for example an existing Android
project, or user accounts), the story cards say so.

---

I have an existing application in this GitHub repository. It is a Splitwise-like expense-sharing application.

Your task is to inspect the COMPLETE repository first, understand the existing architecture and functionality, and then make this application production-ready for deployment to the Google Play Store.

IMPORTANT:
- Do NOT rewrite the application from scratch.
- Preserve all currently working functionality.
- First inspect the repository and identify the frontend/mobile framework, backend, authentication, database, APIs, environment configuration, Android configuration, and third-party SDKs.
- Do not assume the application is Flutter, React Native, native Android, etc. Determine this from the repository.
- Before making major architectural changes, prefer the smallest production-safe change.
- Never hardcode production secrets, passwords, API keys, signing credentials, or service-account credentials into source control.
- Do not commit keystores or sensitive configuration.
- Clearly separate tasks that can be implemented in code from tasks I must manually complete in Google Play Console.

The target outcome is:

Existing GitHub App
→ Production configuration
→ Secure Android release
→ Signed Android App Bundle (.aab)
→ Internal testing
→ Closed testing if required
→ Play Console compliance
→ Production release

Complete the following 8 stages.

# 1. MAKE THE APPLICATION PRODUCTION-READY

Audit the entire application for production deployment.

Check and fix, where applicable:

- Debug/development configuration
- Production API/base URLs
- HTTP vs HTTPS
- Environment variables
- Hardcoded secrets
- API keys
- Authentication configuration
- Database configuration
- Logging
- Debug logging containing sensitive information
- Error handling
- Crash handling
- Network failures
- Loading states
- Authentication expiration
- Logout
- App startup failures
- Backend availability failures
- Production CORS configuration if relevant
- Secure storage of authentication tokens
- Firebase configuration if used
- Analytics configuration if used
- Crashlytics/error reporting if used
- Push notification configuration if used
- Android permissions
- Unnecessary permissions
- Application/package ID
- Application name
- App icon
- Splash screen
- Android version configuration
- versionCode/versionName
- current Google Play target API requirements
- minSdk compatibility
- release build configuration
- ProGuard/R8/minification rules if applicable

Search the repository for exposed secrets or credentials.

Create/update .gitignore so that sensitive production files cannot accidentally be committed.

Do NOT delete working functionality merely to simplify deployment.

# 2. GOOGLE PLAY DEVELOPER ACCOUNT PREPARATION

This part cannot necessarily be automated from code.

Create:

docs/google-play/PLAY_CONSOLE_SETUP.md

Document everything I need to manually do to create/configure the Google Play Developer account.

Include:

- Personal vs Organization account considerations
- Developer verification
- Contact information requirements
- Google Play developer registration fee
- Package-name considerations
- App creation process
- Play App Signing
- Upload-key/signing-key concepts

Clearly label every item as:

MANUAL ACTION REQUIRED

Do not fabricate information that must come from my Google account.

# 3. PLAY STORE LISTING

Create:

docs/google-play/STORE_LISTING.md

Based on the actual functionality found in this repository, prepare a draft of:

- App name
- Short description
- Full description
- App category recommendation
- Main features
- Suggested screenshot list
- Feature graphic requirements
- App icon requirements
- Support/contact information placeholders
- Privacy-policy URL placeholder

Do not claim functionality that doesn't exist in the repository.

Also create:

docs/google-play/assets/

with a README explaining exactly which Play Store graphical assets I need to create and their current required dimensions/formats.

If usable icons/assets already exist in the repository, identify them.

# 4. GOOGLE PLAY DECLARATIONS AND COMPLIANCE

Inspect what the application ACTUALLY does and create:

docs/google-play/PLAY_CONSOLE_DECLARATIONS.md

Prepare a section for every relevant Play Console declaration, including at minimum:

- Data Safety
- Privacy Policy
- App Access
- Ads
- Content Rating
- Target Audience
- Financial Features
- Health Apps declaration if applicable
- Sensitive permissions
- Account creation/deletion requirements
- Any other declaration currently required for this application's functionality

For each declaration provide:

1. What functionality in THIS repository affects the declaration.
2. What data the application collects.
3. Why the data is collected.
4. Whether data leaves the device.
5. Whether data is shared with third parties.
6. Whether data is encrypted in transit.
7. Whether users can request/delete their data.
8. Which third-party SDKs affect the declaration.
9. What I likely need to select in Play Console.
10. Anything that requires my confirmation.

DO NOT blindly answer compliance questions.

If something cannot be determined from the source code, write:

OWNER CONFIRMATION REQUIRED

Pay particular attention to expense-related data and determine whether the app merely records/calculates expenses and balances or actually provides financial functionality such as payments, money transfers, wallets, loans, investing, etc.

Do not classify it as a financial-services application solely because monetary values are stored.

# 5. PRIVACY POLICY AND ACCOUNT DELETION

Based only on verified application behavior, create a draft:

docs/google-play/PRIVACY_POLICY.md

Cover applicable topics such as:

- Information collected
- Account information
- Expense/group information
- How information is used
- Data storage
- Data transmission
- Third-party services
- Analytics
- Crash reporting
- Data retention
- Account deletion
- User data deletion
- Security
- Children's privacy/target audience where relevant
- Contact-information placeholder

Mark anything requiring legal/business-owner input.

Do NOT invent legal claims.

If the app allows users to create accounts, inspect whether account deletion is properly implemented.

If deletion functionality required by Google Play is missing, implement an appropriate account-deletion flow where technically possible, without breaking existing authentication.

Document backend/manual requirements separately.

# 6. ANDROID RELEASE + SIGNED AAB

Configure the Android project for a proper release build.

I need the final result to be capable of producing:

app-release.aab

Configure/fix as appropriate:

- applicationId/package name
- versionCode
- versionName
- release build type
- signing configuration
- minification
- resource shrinking where appropriate
- ProGuard/R8
- manifest configuration
- permissions
- network security
- production API configuration
- release environment
- launcher icon
- app label
- Firebase release configuration if applicable

IMPORTANT SECURITY REQUIREMENT:

Do NOT generate or commit private signing credentials into Git.

If signing credentials are required, configure the project so credentials can come from an ignored local properties file, environment variables, CI secrets, or another secure mechanism.

Document exactly how I can create/configure my upload key locally.

Create:

docs/google-play/BUILD_RELEASE.md

Include the exact commands for this repository to:

1. Clean dependencies/build artifacts where appropriate.
2. Install dependencies.
3. Run tests.
4. Run static analysis/lint.
5. Build the release.
6. Generate the .aab.
7. Locate the generated .aab.
8. Verify the release artifact.

Actually run all reasonable build/test/static-analysis commands available in the environment.

Do not claim a build succeeded unless you actually executed it successfully.

# 7. TESTING BEFORE PLAY STORE RELEASE

Create:

docs/google-play/RELEASE_TESTING.md

Create a practical testing checklist covering:

- Fresh installation
- Registration
- Login
- Logout
- Password reset if supported
- Account deletion
- Creating groups
- Adding members
- Creating expenses
- Editing expenses
- Deleting expenses
- Expense splitting
- Balance calculations
- Settlement functionality if supported
- Offline/network failure behavior
- Slow network
- Backend errors
- Session expiration
- App restart
- Notifications if supported
- Deep links if supported
- Different Android versions
- Different screen sizes
- Release build rather than debug build

Also document:

Internal Testing
→ Closed Testing
→ Production

Explain any current Google Play testing requirement that may apply to a newly created Personal developer account, but mark requirements that depend on my account as:

VERIFY IN PLAY CONSOLE

If automated tests already exist, run them.

Add high-value automated tests only where they can be added safely without redesigning the application.

# 8. PRODUCTION RELEASE CHECKLIST

Create:

docs/google-play/PRODUCTION_RELEASE_CHECKLIST.md

Make this a final checkbox-based checklist covering everything required before I click Submit/Send for Review in Play Console.

Include:

Developer account
[ ] Developer verification complete
[ ] Registration/payment complete

Application
[ ] Production backend configured
[ ] HTTPS enabled
[ ] Production environment configured
[ ] No production secrets committed
[ ] Release build tested
[ ] versionCode/versionName correct

Security
[ ] Signing/upload key securely stored
[ ] No sensitive information logged
[ ] Permissions reviewed
[ ] Authentication/session handling reviewed

Play Store
[ ] Store listing complete
[ ] App icon uploaded
[ ] Screenshots uploaded
[ ] Feature graphic uploaded
[ ] Support details entered
[ ] Privacy policy publicly accessible

Compliance
[ ] Data Safety completed
[ ] App Access completed
[ ] Ads declaration completed
[ ] Content Rating completed
[ ] Target Audience completed
[ ] Financial Features completed
[ ] Health declaration completed if required
[ ] Sensitive permission declarations completed if required
[ ] Account deletion requirements satisfied

Testing
[ ] Internal testing completed
[ ] Closed testing completed if required
[ ] Production AAB tested
[ ] Reviewer/demo account created if authentication is required

Release
[ ] Correct AAB uploaded
[ ] Release notes entered
[ ] Countries/regions selected
[ ] Pricing configured
[ ] Production release reviewed
[ ] Ready to submit for Google review

# REVIEWER ACCOUNT

If authentication is required to use important functionality, create:

docs/google-play/REVIEWER_ACCESS.md

Explain what test data/account Google reviewers need.

Do NOT put a real password in Git.

Use placeholders such as:

Email: <PLAY_REVIEWER_EMAIL>
Password: <CONFIGURE_SECURELY>

Describe exactly what a reviewer should do after logging in to test the core functionality.

# FINAL REPOSITORY AUDIT

After completing the changes, perform another complete repository audit.

Specifically search for:

- API keys
- passwords
- tokens
- private keys
- signing keys
- keystores
- development URLs
- localhost URLs
- HTTP production URLs
- debug flags
- TODOs affecting production
- excessive Android permissions
- test credentials
- Firebase/service credentials

Do not delete legitimate examples or documentation simply because they contain words such as "password"; evaluate whether they represent actual secrets.

# FINAL RESPONSE

When finished, give me a concise report with these sections:

## Changes Made
List the files/configurations changed.

## Build Status
State whether the production Android App Bundle was successfully generated.

If yes, give its exact path.

If no, give the exact blocker and next command/action required.

## Tests
Show which tests/checks were actually executed and their results.

## Security Findings
List any security/configuration concerns discovered.

## Play Console Manual Actions
List everything I still have to manually do in Google Play Console.

## Owner Confirmation Required
List every compliance/privacy question that cannot safely be determined from the repository.

## Ready / Not Ready
Do NOT simply say the app is production-ready unless all repository-side requirements have actually been verified.

Instead state exactly which technical requirements are complete and which remain outstanding.

Do not upload or publish anything to Google Play automatically. Stop once the repository, documentation, release configuration, and AAB are prepared for me to review.
