import frappe
from frappe.utils import get_system_timezone

no_cache = 1


def get_context(context):
    # This ensures frappe.session.csrf_token is generated and available
    context.csrf_token = frappe.sessions.get_csrf_token()
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
