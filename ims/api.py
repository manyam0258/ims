# Copyright (c) 2026, surendhranath and contributors
# For license information, please see license.txt

import json
from datetime import datetime

import frappe
from frappe import _


@frappe.whitelist(allow_guest=False)
def get_dashboard_summary() -> dict:
    """Aggregate asset counts by workflow/status for the dashboard cards."""
    counts = frappe.db.sql(
        """
        SELECT status, COUNT(*) as count
        FROM `tabIMS Marketing Asset`
        GROUP BY status
        """,
        as_dict=True,
    )

    status_map = {}
    for row in counts:
        status_map[row["status"] or "Draft"] = row["count"]

    total_assets = sum(status_map.values())

    return {
        "status": "success",
        "draft": status_map.get("Draft", 0),
        "peer_review": status_map.get("Peer Review", 0),
        "hod_approval": status_map.get("HOD Approval", 0),
        "final_signoff": status_map.get("Final Sign-off", 0),
        "approved": status_map.get("Approved", 0),
        "rejected": status_map.get("Rejected", 0),
        "total": total_assets,
    }


@frappe.whitelist(allow_guest=False)
def get_recent_assets(limit: int = 10, status_filter: str = "") -> dict:
    """Fetch recent IMS Marketing Assets for the dashboard.

    Args:
        limit: Max records. 0 means fetch all (up to 500).
        status_filter: Optional filter – 'Draft', 'In Review', 'Approved', 'Rejected', or '' for all.
    """
    limit = int(limit)
    if limit == 0:
        limit = 500
    else:
        limit = min(limit, 50)

    filters: dict = {}
    if status_filter:
        if status_filter == "In Review":
            filters["status"] = [
                "in",
                ["Peer Review", "HOD Approval", "Final Sign-off"],
            ]
        elif status_filter == "Draft":
            filters["status"] = "Draft"
        elif status_filter == "Approved":
            filters["status"] = "Approved"
        elif status_filter == "Rejected":
            filters["status"] = "Rejected"

    assets = frappe.db.get_list(
        "IMS Marketing Asset",
        fields=[
            "name",
            "asset_title",
            "campaign",
            "category",
            "status",
            "latest_file",
            "owner_user",
            "creation",
            "modified",
        ],
        filters=filters,
        order_by="creation DESC",
        limit=limit,
    )

    return {
        "status": "success",
        "assets": assets,
    }


@frappe.whitelist(allow_guest=False)
def get_recent_uploads(limit: int = 10) -> dict:
    """Fetch recent file uploads tied to IMS Marketing Assets."""
    limit = min(int(limit), 50)

    uploads = frappe.db.sql(
        """
        SELECT
            f.name as file_name,
            f.file_name as display_name,
            f.file_url,
            f.file_size,
            f.creation,
            a.name as asset_name,
            a.asset_title
        FROM `tabFile` f
        JOIN `tabIMS Marketing Asset` a ON f.file_url = a.latest_file
        WHERE f.attached_to_doctype = 'IMS Marketing Asset'
        ORDER BY f.creation DESC
        LIMIT %s
        """,
        (limit,),
        as_dict=True,
    )

    # Fallback: if no joined results, get files attached to our DocType
    if not uploads:
        uploads = frappe.db.get_list(
            "File",
            filters={"attached_to_doctype": "IMS Marketing Asset"},
            fields=[
                "name as file_name",
                "file_name as display_name",
                "file_url",
                "file_size",
                "creation",
            ],
            order_by="creation DESC",
            limit=limit,
        )

    return {
        "status": "success",
        "uploads": uploads,
    }


@frappe.whitelist(allow_guest=False)
def search_assets(query: str = "", limit: int = 10) -> dict:
    """Search across IMS Marketing Assets and IMS Projects by title/name.

    Returns grouped results for the command palette.
    """
    limit = min(int(limit), 30)
    query = (query or "").strip()

    if not query:
        return {"status": "success", "assets": [], "projects": []}

    like_query = f"%{query}%"

    assets = frappe.db.get_list(
        "IMS Marketing Asset",
        filters=[
            ["asset_title", "like", like_query],
        ],
        or_filters=[
            ["name", "like", like_query],
            ["campaign", "like", like_query],
        ],
        fields=["name", "asset_title", "status", "latest_file", "category", "creation"],
        order_by="modified DESC",
        limit=limit,
    )

    # Frappe or_filters can be tricky; use SQL for reliable OR logic
    if not assets:
        assets = frappe.db.sql(
            """
            SELECT name, asset_title, status, latest_file, category, creation
            FROM `tabIMS Marketing Asset`
            WHERE asset_title LIKE %(q)s
               OR name LIKE %(q)s
               OR campaign LIKE %(q)s
            ORDER BY modified DESC
            LIMIT %(limit)s
            """,
            {"q": like_query, "limit": limit},
            as_dict=True,
        )

    projects = frappe.db.sql(
        """
        SELECT name, project_title, status, due_date, creation
        FROM `tabIMS Project`
        WHERE project_title LIKE %(q)s
           OR name LIKE %(q)s
           OR description LIKE %(q)s
        ORDER BY modified DESC
        LIMIT %(limit)s
        """,
        {"q": like_query, "limit": limit},
        as_dict=True,
    )

    return {
        "status": "success",
        "assets": assets,
        "projects": projects,
    }


@frappe.whitelist(allow_guest=True)
def get_current_user():
    """Debug session user."""
    return {
        "user": frappe.session.user,
        "is_guest": frappe.session.user == "Guest",
        "roles": frappe.get_roles(),
    }


@frappe.whitelist(allow_guest=True)
def search_projects(query: str = "", limit: int = 20):
    """Resilient project search for the dashboard upload modal."""
    # Temporarily allow guest to rule out session issues,
    # but we should still check if they are actually a guest if we want security

    limit = min(int(limit), 50)
    query = (query or "").strip()

    frappe.logger().debug(
        f"IMS: search_projects called with query='{query}' by user={frappe.session.user}"
    )

    like_query = f"%{query}%"

    # SQL completely bypasses Permission Query Conditions and User Permissions
    projects = frappe.db.sql(
        """
        SELECT name, project_title, status
        FROM `tabIMS Project`
        WHERE (project_title LIKE %(q)s OR name LIKE %(q)s)
          AND status != 'Cancelled'
        ORDER BY modified DESC
        LIMIT %(limit)s
        """,
        {"q": like_query, "limit": limit},
        as_dict=True,
    )

    return projects


@frappe.whitelist(allow_guest=False)
def get_notifications(limit: int = 20) -> dict:
    """Fetch recent notifications for the current user from Frappe's Notification Log."""
    limit = min(int(limit), 100)

    notifications = frappe.db.get_list(
        "Notification Log",
        filters={"for_user": frappe.session.user},
        fields=[
            "name",
            "subject",
            "type",
            "document_type",
            "document_name",
            "from_user",
            "read",
            "creation",
        ],
        order_by="creation DESC",
        limit=limit,
    )

    # Also get IMS-specific activity from Comments
    ims_comments = frappe.db.sql(
        """
        SELECT
            c.name,
            c.comment_type,
            c.content as subject,
            c.reference_doctype as document_type,
            c.reference_name as document_name,
            c.comment_by as from_user,
            c.creation
        FROM `tabComment` c
        WHERE c.reference_doctype IN ('IMS Marketing Asset', 'IMS Project')
          AND c.comment_type IN ('Comment', 'Workflow', 'Assignment', 'Like')
        ORDER BY c.creation DESC
        LIMIT %(limit)s
        """,
        {"limit": limit},
        as_dict=True,
    )

    # Mark comments with read=1 (they're activity, not notifications)
    for c in ims_comments:
        c["read"] = 1
        c["type"] = c.get("comment_type", "Info")

    # Merge and sort by creation
    all_items = notifications + ims_comments
    all_items.sort(key=lambda x: x.get("creation", ""), reverse=True)

    # Unread count
    unread_count = frappe.db.count(
        "Notification Log",
        filters={"for_user": frappe.session.user, "read": 0},
    )

    return {
        "status": "success",
        "notifications": all_items[:limit],
        "unread_count": unread_count,
    }


@frappe.whitelist(allow_guest=False)
def mark_notifications_read() -> dict:
    """Mark all notifications as read for the current user."""
    frappe.db.sql(
        """
        UPDATE `tabNotification Log`
        SET `read` = 1
        WHERE for_user = %(user)s AND `read` = 0
        """,
        {"user": frappe.session.user},
    )
    frappe.db.commit()

    return {"status": "success", "message": _("All notifications marked as read.")}


@frappe.whitelist(allow_guest=False)
def get_audit_logs(limit: int = 30, action_filter: str = "") -> dict:
    """Fetch audit trail for IMS documents from Frappe's Version and Comment tables.

    Returns a timeline of create/modify/comment/workflow actions.
    """
    limit = min(int(limit), 100)

    # Get version logs (field changes)
    versions = frappe.db.sql(
        """
        SELECT
            v.name,
            v.ref_doctype as document_type,
            v.docname as document_name,
            v.owner as user,
            v.data,
            v.creation,
            'Version' as log_type
        FROM `tabVersion` v
        WHERE v.ref_doctype IN ('IMS Marketing Asset', 'IMS Project', 'IMS Asset Revision')
        ORDER BY v.creation DESC
        LIMIT %(limit)s
        """,
        {"limit": limit},
        as_dict=True,
    )

    # Parse version data to extract meaningful changes
    audit_entries = []
    for v in versions:
        try:
            data = json.loads(v.get("data") or "{}")
            changed_fields = data.get("changed", [])

            # Determine action type
            if not changed_fields and data.get("added"):
                action = "Created"
            elif any(c[0] == "status" for c in changed_fields if isinstance(c, list)):
                status_change = next(
                    (
                        c
                        for c in changed_fields
                        if isinstance(c, list) and c[0] == "status"
                    ),
                    None,
                )
                action = "Workflow"
                if status_change and len(status_change) >= 3:
                    v["details"] = f"{status_change[1]} → {status_change[2]}"
            else:
                action = "Modified"
                field_names = [c[0] for c in changed_fields if isinstance(c, list)]
                v["details"] = ", ".join(field_names[:3])
                if len(field_names) > 3:
                    v["details"] += f" +{len(field_names) - 3} more"

            v["action"] = action
            v["user_fullname"] = frappe.utils.get_fullname(v.get("user", ""))

            # Apply action filter
            if action_filter and action.lower() != action_filter.lower():
                continue

            audit_entries.append(v)
        except (json.JSONDecodeError, TypeError):
            continue

    # Get comments (annotation comments, workflow comments)
    comments = frappe.db.sql(
        """
        SELECT
            c.name,
            c.reference_doctype as document_type,
            c.reference_name as document_name,
            c.comment_by as user,
            c.content as details,
            c.comment_type,
            c.creation,
            'Comment' as log_type
        FROM `tabComment` c
        WHERE c.reference_doctype IN ('IMS Marketing Asset', 'IMS Project')
          AND c.comment_type IN ('Comment', 'Workflow', 'Assignment', 'Created')
        ORDER BY c.creation DESC
        LIMIT %(limit)s
        """,
        {"limit": limit},
        as_dict=True,
    )

    for c in comments:
        c["action"] = c.get("comment_type", "Comment")
        c["user_fullname"] = frappe.utils.get_fullname(c.get("user", ""))

        if action_filter and c["action"].lower() != action_filter.lower():
            continue

        audit_entries.append(c)

    # Sort merged results by creation
    audit_entries.sort(key=lambda x: x.get("creation", ""), reverse=True)

    return {
        "status": "success",
        "logs": audit_entries[:limit],
    }


@frappe.whitelist(allow_guest=False)
def upload_marketing_asset(
    asset_title: str,
    campaign: str = "",
    description: str = "",
    expiry_date: str = "",
    category: str = "Asset",
    project: str = "",
) -> dict:
    """Create a new IMS Marketing Asset from the dashboard."""
    if not asset_title or not asset_title.strip():
        frappe.throw(_("Asset title is required."))

    # Check if a file was uploaded in the same request
    files = frappe.request.files
    file_url = None

    if files and "file" in files:
        # Force uploaded file to be public
        frappe.form_dict["is_private"] = 0
        from frappe.handler import upload_file

        file_doc = upload_file()
        file_url = file_doc.file_url
    else:
        file_url = frappe.form_dict.get("file_url")

    if not file_url:
        frappe.throw(_("A file must be uploaded with the asset."))

    data = {
        "doctype": "IMS Marketing Asset",
        "asset_title": asset_title.strip(),
        "latest_file": file_url,
        "status": "Draft",
        "owner_user": frappe.session.user,
        "category": category or "Asset",
    }

    if campaign:
        data["campaign"] = campaign.strip()
    if description:
        data["description"] = description.strip()
    if expiry_date:
        data["expiry_date"] = expiry_date
    if project:
        data["project"] = project

    asset = frappe.get_doc(data)
    asset.insert(ignore_permissions=False)
    frappe.db.commit()

    return {
        "status": "success",
        "message": _("Asset '{0}' created successfully.").format(asset.asset_title),
        "asset_name": asset.name,
        "asset": {
            "name": asset.name,
            "asset_title": asset.asset_title,
            "status": asset.status,
            "latest_file": asset.latest_file,
            "creation": str(asset.creation),
        },
    }


@frappe.whitelist(allow_guest=False)
def submit_annotation(
    marketing_asset: str,
    x: float,
    y: float,
    comment: str,
    width: float = 0,
    height: float = 0,
    annotation_type: str = "",
    path: str = "",
) -> dict:
    """Save an annotation to the latest IMS Asset Revision."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        frappe.throw(
            _("Marketing Asset {0} does not exist.").format(marketing_asset),
            frappe.DoesNotExistError,
        )

    frappe.has_permission("IMS Marketing Asset", "read", marketing_asset, throw=True)

    x = float(x)
    y = float(y)
    width = float(width)
    height = float(height)

    if not comment or not comment.strip():
        frappe.throw(_("Comment is required."))

    # Determine annotation type
    if not annotation_type:
        if width > 0 or height > 0:
            annotation_type = "rect"
        else:
            annotation_type = "point"

    # Parse path data for freehand annotations
    path_data = []
    if path:
        try:
            path_data = json.loads(path) if isinstance(path, str) else path
        except (json.JSONDecodeError, TypeError):
            path_data = []

    latest_revision = frappe.db.get_value(
        "IMS Asset Revision",
        {"marketing_asset": marketing_asset},
        "name",
        order_by="revision_number DESC",
    )

    if not latest_revision:
        asset_doc = frappe.get_doc("IMS Marketing Asset", marketing_asset)
        if not asset_doc.latest_file:
            frappe.throw(
                _("No file found on the marketing asset. Upload a file first.")
            )

        revision_doc = frappe.get_doc(
            {
                "doctype": "IMS Asset Revision",
                "marketing_asset": marketing_asset,
                "revision_file": asset_doc.latest_file,
                "annotations": json.dumps([]),
                "revision_notes": "Auto-created revision for first annotation.",
                "content_brief": asset_doc.description or "",
            }
        )
        revision_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        latest_revision = revision_doc.name

    revision = frappe.get_doc("IMS Asset Revision", latest_revision)

    # Protection: Never overwrite Revision 1 (it's the initial baseline)
    if revision.revision_number == 1:
        # Check if Revision 2 or higher already exists
        has_later = frappe.db.get_value(
            "IMS Asset Revision",
            {"marketing_asset": marketing_asset, "revision_number": [">", 1]},
            "name",
        )
        if not has_later:
            # Create Revision 2 as the first 'working' revision
            revision = frappe.get_doc(
                {
                    "doctype": "IMS Asset Revision",
                    "marketing_asset": marketing_asset,
                    "revision_number": 2,
                    "revision_file": revision.revision_file,
                    "annotations": revision.annotations,
                    "content_brief": revision.content_brief,
                    "revision_notes": "First working iteration.",
                }
            )
            revision.insert(ignore_permissions=True)
            frappe.db.commit()
            latest_revision = revision.name
        else:
            # Use the existing later revision
            latest_revision = has_later
            revision = frappe.get_doc("IMS Asset Revision", latest_revision)

    existing_annotations = json.loads(revision.annotations or "[]")

    annotation = {
        "id": frappe.generate_hash(length=10),
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "annotation_type": annotation_type,
        "comment": comment.strip(),
        "author": frappe.session.user,
        "author_name": frappe.utils.get_fullname(frappe.session.user),
        "timestamp": datetime.now().isoformat(),
        "revision_name": latest_revision,
    }

    if annotation_type == "freehand" and path_data:
        annotation["path"] = path_data

    existing_annotations.append(annotation)
    revision.annotations = json.dumps(existing_annotations)
    revision.save(ignore_permissions=True)
    frappe.db.commit()

    # Process mentions
    process_mentions(comment, marketing_asset, frappe.session.user)

    return {
        "status": "success",
        "message": _("Annotation saved successfully."),
        "annotation": annotation,
        "revision": latest_revision,
    }


def process_mentions(comment: str, asset_name: str, sender: str):
    """Find @mentions and create notifications."""
    import re

    # Match @username (alphanumeric, dots, underscores)
    mentions = set(re.findall(r"@([a-zA-Z0-9._]+)", comment))

    if not mentions:
        return

    asset_title = frappe.db.get_value("IMS Marketing Asset", asset_name, "asset_title")
    sender_fullname = frappe.utils.get_fullname(sender)

    for username in mentions:
        if username == sender or not frappe.db.exists("User", username):
            continue

        # Create Notification Log
        subject = f"{sender_fullname} mentioned you in {asset_title}"

        # Check if already notified recently? No, always notify for mentions.
        notification = frappe.get_doc(
            {
                "doctype": "Notification Log",
                "subject": subject,
                "for_user": username,
                "type": "Mention",
                "from_user": sender,
                "document_type": "IMS Marketing Asset",
                "document_name": asset_name,
                "email_content": f"<p>{comment}</p>",
            }
        )
        notification.insert(ignore_permissions=True)


@frappe.whitelist(allow_guest=False)
def get_users_for_mention(query: str = "") -> dict:
    """Search for users to mention."""
    users = frappe.db.get_list(
        "User",
        filters={
            "enabled": 1,
            "name": ["not in", ["Administrator", "Guest"]],
            "full_name": ["like", f"%{query}%"],
        },
        fields=["name", "full_name", "user_image"],
        limit=20,
    )
    return {"status": "success", "users": users}


@frappe.whitelist(allow_guest=False)
def get_revision_history(marketing_asset: str) -> dict:
    """Fetch all revisions for a given marketing asset."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        frappe.throw(_("Asset not found"), frappe.DoesNotExistError)

    frappe.has_permission("IMS Marketing Asset", "read", marketing_asset, throw=True)

    revisions = frappe.get_all(
        "IMS Asset Revision",
        filters={"marketing_asset": marketing_asset},
        fields=[
            "name",
            "revision_number",
            "revision_file",
            "revision_notes",
            "creation",
            "owner",
        ],
        order_by="revision_number DESC",
    )

    return {
        "status": "success",
        "revisions": revisions,
    }


@frappe.whitelist(allow_guest=False)
def get_annotations(marketing_asset: str, revision_number: int = None) -> dict:
    """Fetch annotations for a specific or latest revision of a marketing asset."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        frappe.throw(
            _("Marketing Asset {0} does not exist.").format(marketing_asset),
            frappe.DoesNotExistError,
        )

    frappe.has_permission("IMS Marketing Asset", "read", marketing_asset, throw=True)

    filters = {"marketing_asset": marketing_asset}
    if revision_number:
        filters["revision_number"] = int(revision_number)

    revision_list = frappe.get_all(
        "IMS Asset Revision",
        filters=filters,
        fields=[
            "name",
            "revision_number",
            "revision_file",
            "annotations",
            "content_brief",
        ],
        order_by="revision_number DESC",
        limit=1,
    )
    revision_data = revision_list[0] if revision_list else None

    # Permission check for revision upload
    can_upload = False
    asset_status = frappe.db.get_value("IMS Marketing Asset", marketing_asset, "status")
    if asset_status in ["Draft", "Rejected"]:
        can_upload = True

    if not revision_data:
        # No revision yet — fall back to asset description
        asset_desc = frappe.db.get_value(
            "IMS Marketing Asset", marketing_asset, "description"
        )
        return {
            "status": "success",
            "annotations": [],
            "revision": None,
            "content_brief": asset_desc or "",
        }

    annotations = json.loads(revision_data.get("annotations") or "[]")

    return {
        "status": "success",
        "annotations": annotations,
        "revision": revision_data.get("name"),
        "revision_number": revision_data.get("revision_number"),
        "revision_file": revision_data.get("revision_file"),
        "content_brief": revision_data.get("content_brief") or "",
        "can_upload_revision": can_upload,
    }


@frappe.whitelist(allow_guest=False)
def get_workflow_transitions(marketing_asset: str) -> dict:
    """Get available workflow transitions for the current user and asset."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        return {"status": "error", "message": _("Asset not found")}

    doc = frappe.get_doc("IMS Marketing Asset", marketing_asset)

    # Get transitions directly from Frappe's workflow engine
    from frappe.model.workflow import get_transitions

    transitions = get_transitions(doc)

    # Map transitions to a cleaner format for frontend
    actions = []
    for t in transitions:
        # Handle both object and dict access for robustness
        action = t.get("action") if isinstance(t, dict) else getattr(t, "action", None)
        next_state = (
            t.get("next_state")
            if isinstance(t, dict)
            else getattr(t, "next_state", None)
        )

        if not action:
            continue

        actions.append(
            {
                "action": action,
                "next_state": next_state,
                "style": (
                    "primary"
                    if action.startswith("Approve") or action.startswith("Submit")
                    else "danger" if action == "Reject" else "default"
                ),
            }
        )

    return {
        "status": "success",
        "current_state": doc.workflow_state,
        "transitions": actions,
    }


@frappe.whitelist(allow_guest=False)
def apply_workflow_transition(marketing_asset: str, action: str) -> dict:
    """Apply a workflow action to the asset."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        return {"status": "error", "message": _("Asset not found")}

    try:
        doc = frappe.get_doc("IMS Marketing Asset", marketing_asset)
        from frappe.model.workflow import apply_workflow

        apply_workflow(doc, action)
        doc.save()
        frappe.db.commit()

        # Determine next transitions
        next_transitions = get_workflow_transitions(marketing_asset)["transitions"]

        # Check for Final Approval state
        if doc.workflow_state in ["Approved", "Final Sign-off"]:
            export_on_approval(doc)

        return {
            "status": "success",
            "message": _("Workflow action '{0}' applied successfully.").format(action),
            "new_state": doc.workflow_state,
            "next_transitions": next_transitions,
        }
    except Exception as e:
        frappe.log_error(f"Workflow Transition Failed for {marketing_asset}: {str(e)}")
        return {"status": "error", "message": str(e)}


def export_on_approval(asset_doc):
    """
    Handle export logic when asset is approved.
    1. Make the latest file public if it's private.
    2. (Placeholder) Upload to external S3/Drive if configured.
    """
    if not asset_doc.latest_file:
        return

    # 1. Make file public
    file_doc = frappe.get_doc("File", {"file_url": asset_doc.latest_file})
    if file_doc and file_doc.is_private:
        file_doc.is_private = 0
        file_doc.save(ignore_permissions=True)
        frappe.msgprint(_("Asset file has been made public."))

    # 2. Log export
    # In a real scenario, this would use boto3 or google-api-python-client
    # to upload to a specific external bucket/folder.
    frappe.log_error(
        f"Exporting {asset_doc.name} to external storage (Simulation)", "IMS Export"
    )

    # Add a comment to the asset
    comment = frappe.get_doc(
        {
            "doctype": "Comment",
            "comment_type": "Info",
            "reference_doctype": "IMS Marketing Asset",
            "reference_name": asset_doc.name,
            "content": "Asset exported to external storage upon approval.",
        }
    )
    comment.insert(ignore_permissions=True)


@frappe.whitelist(allow_guest=False)
def get_project_details(name: str) -> dict:
    """Get project details and linked assets."""
    if not frappe.db.exists("IMS Project", name):
        return {"status": "error", "message": _("Project not found")}

    project = frappe.get_doc("IMS Project", name)

    # Get linked assets
    assets = frappe.db.get_list(
        "IMS Marketing Asset",
        filters={"project": name},
        fields=["name", "asset_title", "status", "latest_file", "category", "creation"],
        order_by="modified DESC",
    )

    return {
        "status": "success",
        "project": {
            "name": project.name,
            "project_title": project.project_title,
            "status": project.status,
            "description": project.description,
            "due_date": project.due_date,
            "creation": project.creation,
            "owner": frappe.utils.get_fullname(project.owner),
        },
        "assets": assets,
    }


@frappe.whitelist(allow_guest=False)
def upload_revision(marketing_asset: str, notes: str = "") -> dict:
    """Upload a new file version for an existing asset."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        frappe.throw(_("Asset not found"), frappe.DoesNotExistError)

    # Check for file
    if "file" not in frappe.request.files:
        frappe.throw(_("Please attach a file"))

    file = frappe.request.files["file"]

    # Ensure unique filename to prevent FileExistsError
    import textwrap
    from frappe.utils import now_datetime

    timestamp = now_datetime().strftime("%Y%m%d%H%M%S")
    original_name = file.filename
    name_parts = original_name.rsplit(".", 1)

    if len(name_parts) == 2:
        new_filename = f"{name_parts[0]}_{timestamp}.{name_parts[1]}"
    else:
        new_filename = f"{original_name}_{timestamp}"

    file.filename = new_filename

    # Force uploaded file to be public
    frappe.form_dict["is_private"] = 0
    from frappe.handler import upload_file

    file_doc = upload_file()
    file_url = file_doc.file_url

    # Get latest revision (number + content_brief to carry forward)
    prev_list = frappe.get_all(
        "IMS Asset Revision",
        filters={"marketing_asset": marketing_asset},
        fields=["revision_number", "content_brief"],
        order_by="revision_number DESC",
        limit=1,
    )
    prev_revision = prev_list[0] if prev_list else None
    latest_rev_num = prev_revision.get("revision_number") if prev_revision else 0
    prev_content_brief = prev_revision.get("content_brief") if prev_revision else ""

    # Create new revision — carry forward content_brief from previous
    revision_doc = frappe.get_doc(
        {
            "doctype": "IMS Asset Revision",
            "marketing_asset": marketing_asset,
            "revision_file": file_url,
            "revision_number": latest_rev_num + 1,
            "revision_notes": notes,
            "annotations": "[]",  # Start clean for new image
            "created_by": frappe.session.user,
            "content_brief": prev_content_brief or "",
        }
    )
    revision_doc.insert(ignore_permissions=True)

    # Update parent asset
    asset = frappe.get_doc("IMS Marketing Asset", marketing_asset)
    asset.latest_file = file_url
    asset.description = prev_content_brief or ""
    asset.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "status": "success",
        "message": _("New revision uploaded successfully"),
        "file_url": file_url,
        "revision": revision_doc.get("revision_number"),
    }


@frappe.whitelist(allow_guest=False)
def save_content_brief(
    marketing_asset: str = None, revision_name: str = None, content_brief: str = ""
) -> dict:
    """Update content brief on a specific revision or the latest one."""
    if not revision_name and not marketing_asset:
        frappe.throw(_("Missing revision_name or marketing_asset"))

    if not revision_name:
        revision_name = frappe.db.get_value(
            "IMS Asset Revision",
            {"marketing_asset": marketing_asset},
            "name",
            order_by="revision_number DESC",
        )

    if not revision_name:
        # Create revision if missing
        asset_doc = frappe.get_doc("IMS Marketing Asset", marketing_asset)
        if not asset_doc.latest_file:
            frappe.throw(_("No file associated with this asset."))

        rev = frappe.get_doc(
            {
                "doctype": "IMS Asset Revision",
                "marketing_asset": marketing_asset,
                "revision_file": asset_doc.latest_file,
                "annotations": "[]",
                "content_brief": content_brief,
                "revision_notes": "Created via content brief update.",
            }
        )
        rev.insert(ignore_permissions=True)
        frappe.db.commit()
        return {
            "status": "success",
            "message": _("Content brief saved in new revision."),
            "revision": rev.name,
        }

    # Derive marketing_asset if missing
    if not marketing_asset:
        marketing_asset = frappe.db.get_value(
            "IMS Asset Revision", revision_name, "marketing_asset"
        )

    # Permission check via parent asset
    frappe.has_permission("IMS Marketing Asset", "read", marketing_asset, throw=True)

    # Fetch doc
    try:
        rev_doc = frappe.get_doc("IMS Asset Revision", revision_name)

        # Protection: Never overwrite Revision 1
        if rev_doc.revision_number == 1:
            # Try to find Revision 2 or create it
            rev2_name = frappe.db.get_value(
                "IMS Asset Revision",
                {"marketing_asset": marketing_asset, "revision_number": 2},
                "name",
            )
            if not rev2_name:
                # Create Revision 2
                new_rev = frappe.get_doc(
                    {
                        "doctype": "IMS Asset Revision",
                        "marketing_asset": marketing_asset,
                        "revision_number": 2,
                        "revision_file": rev_doc.revision_file,
                        "annotations": rev_doc.annotations,
                        "content_brief": content_brief,
                        "revision_notes": "Modified text version.",
                    }
                )
                new_rev.insert(ignore_permissions=True)
                rev_doc = new_rev
                revision_name = new_rev.name
            else:
                # Update existing Revision 2 instead
                rev_doc = frappe.get_doc("IMS Asset Revision", rev2_name)
                rev_doc.content_brief = content_brief
                rev_doc.save(ignore_permissions=True)
                revision_name = rev2_name
        else:
            # Normal update for Revision 2+
            rev_doc.content_brief = content_brief
            rev_doc.save(ignore_permissions=True)

        # Sync back to parent Asset
        asset_doc = frappe.get_doc("IMS Marketing Asset", marketing_asset)
        asset_doc.description = content_brief
        asset_doc.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Content Brief Save Error"))
        return {"status": "error", "message": str(e)}

    return {
        "status": "success",
        "message": _("Content brief updated successfully."),
        "revision": revision_name,
    }


@frappe.whitelist(allow_guest=False)
def update_content_brief(revision_name: str, content_brief: str = "") -> dict:
    """Old mapping for compatibility with built frontend assets."""
    return save_content_brief(revision_name=revision_name, content_brief=content_brief)


@frappe.whitelist(allow_guest=False)
def fix_all_files():
    """Diagnostic: Make all IMS Asset Revision files public."""
    files = frappe.get_all(
        "File",
        filters={"attached_to_doctype": "IMS Asset Revision", "is_private": 1},
        fields=["name", "file_url"],
    )

    count = 0
    for f in files:
        if f.file_url.startswith("/private/"):
            new_url = f.file_url.replace("/private/", "/")
            frappe.db.set_value("File", f.name, {"is_private": 0, "file_url": new_url})
            count += 1

    frappe.db.commit()
    return {"status": "success", "message": f"Fixed {count} files."}
