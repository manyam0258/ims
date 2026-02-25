import frappe
from frappe.utils import get_system_timezone

no_cache = 1


def get_context(context):
    # This forces a fresh token generation for the current session
    csrf_token = frappe.sessions.get_csrf_token()
    context.csrf_token = csrf_token

    # Optional: Add headers to prevent downstream caching
    frappe.local.response.headers["Cache-Control"] = (
        "no-store, no-cache, must-revalidate, max-age=0"
    )
    return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
    if not frappe.conf.developer_mode:
        frappe.throw("This method is only meant for developer mode")
    return get_boot()


def get_boot():
    return frappe._dict(
        {
            "frappe_version": frappe.version,
            "site_name": frappe.local.site,
            "read_only_mode": frappe.flags.read_only,
            "system_timezone": get_system_timezone(),
        }
    )
