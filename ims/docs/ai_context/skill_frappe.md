# Skill: Frappe Backend & AWS S3 Management

## Context
- **Framework:** Frappe (v15+)
- **Storage:** AWS S3 for all file attachments in the 'IMS' app.
- **Goal:** Ensure files are correctly linked to DocTypes and stored with proper S3 permissions.
- **Reference:** https://docs.frappe.io/framework/user/en/introduction

## Code Standards
1. **S3 Configuration:** 
   - Credentials must be read from `frappe.conf` or the [S3 Backup Settings](https://docs.erpnext.com/docs/v15/user/manual/en/setting-up/backups/s3-backup-settings).
   - **Never hardcode** AWS keys in Python files.
2. **File Handling:**
   - Use `frappe.get_doc('File', file_name)` to fetch file metadata.
   - When moving files to S3, ensure the `File` record is updated with the new `file_url`.
   - Check `is_private` flag. Private files should not be accessible via public URLs.
3. **Workflow Integration:**
   - Use `frappe.workflow.get_workflow(doctype).get_transitions(doc.name)` to check available transitions.
   - Use `frappe.workflow.make_transition(doc.name, transition_name)` to move the document state.
   - Always check `doc.status` before attempting a transition.
4. **Custom Actions:**
   - Use `@frappe.whitelist(allow_guest=False)` for backend API endpoints.
   - Always validate input data using `frappe.get_val` or by fetching the DocType.
   - Return JSON responses with `status` and `message` keys.
5. **Error Handling:**
   - Use `frappe.throw(message, exc=PermissionError)` for permission issues.
   - Use `frappe.log_error(frappe.get_traceback(), "Error Message")` for debugging.
   - Wrap file operations in try-except blocks to handle S3 connection errors.
6. **Security:**
   - Always check `frappe.has_permission(doctype, "write", docname)` before modifying a document.
   - Use `frappe.get_safe_password()` for generating secure passwords.
   - Never expose sensitive information in logs or error messages.
7. **Database Operations:**
   - Use `frappe.db.get_value(doctype, filters, fieldname)` for fetching single values.
   - Use `frappe.db.get_list(doctype, filters, fields, order_by, limit)` for fetching lists.
   - Use `frappe.db.commit()` after database transactions.
   - Use `frappe.db.rollback()` to undo transactions on error.
8. **Performance:**
   - Use `frappe.get_cached_doc()` for frequently accessed documents.
   - Use `frappe.db.sql()` for complex queries, but always sanitize input.
   - Avoid nested loops over database queries. Use `get_list` with proper filters instead.
9. **Testing:**
   - Use `frappe.get_test_user()` to get a test user for API calls.
   - Use `frappe.get_doc(doctype, name).delete()` to clean up test data.
   - Use `frappe.db.commit()` after test data creation to ensure it persists.
10. **File Operations:**
    - Use `frappe.get_doc('File', file_name)` to fetch file metadata.
    - When moving files to S3, ensure the `File` record is updated with the new `file_url`.
    - Check `is_private` flag. Private files should not be accessible via public URLs.
# Skill: Frappe Framework Backend (IMS)

## 1. DocType Architecture Standards
- **Naming Convention:** Prefix all custom DocTypes with `IMS` (e.g., `IMS Marketing Asset`).
- **Data Integrity:** Use `autoname` with naming series: `IMS-ASSET-.YYYY.-.#####.`.
- **Naming Series Logic:** Ensure each year gets a fresh sequence.

## 2. Workflow & Security
- **State Machine:** Implement a multi-state workflow: Draft -> Peer Review -> HOD Approval -> Final Sign-off -> Approved.
- **Permissions:** - Use `frappe.has_permission()` in `validate` hooks.
    - Assets are `is_private = 1` until the state is `Approved`.
- **Audit Trail:** Enable `Track Changes` on all IMS DocTypes.

## 3. S3 Integration (Enterprise Storage)
- **Trigger:** Server-side hook `on_update` or `on_submit` when `workflow_state == "Approved"`.
- **Implementation:**
    - Utilize `boto3` library for AWS S3/S3-compatible storage.
    - **Logic:**
        1. Fetch the local file path from `frappe.get_doc("File", doc.file_link)`.
        2. Upload to S3 bucket with path: `brandflow/approved/{year}/{filename}`.
        3. Update the `File` record's `file_url` to the S3 Public/Signed URL.
        4. (Optional) Set `is_private = 0` for the specific file record post-upload for CDN access.

## 4. API & Scheduled Jobs
- **Whitelist:** Use `@frappe.whitelist()` for all RPC methods used by the Doppio SPA.
- **Cron Jobs:** Implementation of `all`, `daily`, or `weekly` hooks in `hooks.py` for `expiry_date` alerts.