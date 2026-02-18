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
def get_recent_assets(limit: int = 10) -> dict:
    """Fetch recent IMS Marketing Assets for the dashboard."""
    limit = min(int(limit), 50)

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
        from frappe.handler import upload_file

        file_doc = upload_file()
        file_url = file_doc.file_url
        if not file_doc.is_private:
            file_doc.is_private = 1
            file_doc.save(ignore_permissions=True)
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
            }
        )
        revision_doc.insert(ignore_permissions=False)
        frappe.db.commit()
        latest_revision = revision_doc.name

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
    revision.save(ignore_permissions=False)
    frappe.db.commit()

    return {
        "status": "success",
        "message": _("Annotation saved successfully."),
        "annotation": annotation,
        "revision": latest_revision,
    }


@frappe.whitelist(allow_guest=False)
def get_annotations(marketing_asset: str) -> dict:
    """Fetch all annotations for the latest revision of a marketing asset."""
    if not frappe.db.exists("IMS Marketing Asset", marketing_asset):
        frappe.throw(
            _("Marketing Asset {0} does not exist.").format(marketing_asset),
            frappe.DoesNotExistError,
        )

    frappe.has_permission("IMS Marketing Asset", "read", marketing_asset, throw=True)

    latest_revision = frappe.db.get_value(
        "IMS Asset Revision",
        {"marketing_asset": marketing_asset},
        ["name", "revision_number", "revision_file", "annotations"],
        order_by="revision_number DESC",
        as_dict=True,
    )

    if not latest_revision:
        return {
            "status": "success",
            "annotations": [],
            "revision": None,
        }

    annotations = json.loads(latest_revision.annotations or "[]")

    return {
        "status": "success",
        "annotations": annotations,
        "revision": latest_revision.name,
        "revision_number": latest_revision.revision_number,
        "revision_file": latest_revision.revision_file,
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

        return {
            "status": "success",
            "message": _("Workflow action '{0}' applied successfully.").format(action),
            "new_state": doc.workflow_state,
            "next_transitions": next_transitions,
        }
    except Exception as e:
        frappe.log_error(f"Workflow Transition Failed for {marketing_asset}: {str(e)}")
        return {"status": "error", "message": str(e)}


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
