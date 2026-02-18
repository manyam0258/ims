# Skill: Doppio (Vite + Vue/React Bridge)

## 1. Project Structure
- **Location:** The SPA resides in the `/frontend` or `/ims-dashboard` directory within the Frappe app.
- **Build Tool:** Vite.
- **Environment:** Ensure `VITE_PROXY_URL` points to the Bench local development port (usually 8000).

## 2. Communication Layer
- **Authentication:** Use Frappe's session-based auth for local development and API Keys for production/remote calls.
- **Method Calls:**
    - Standardize on `call('ims.api.v1.method_name', { params })`.
    - Handle 403 (Forbidden) and 401 (Unauthorized) errors globally to redirect to the Frappe login page.

## 3. Data Flow Strategy
- **Client-Side Routing:** Use `vue-router` or `react-router-dom`.
- **State Management:** - Use **Pinia** (Vue) or **Zustand** (React).
    - Store the "Current Asset" and "User Permissions" globally to prevent redundant API calls during workflow transitions.

## 4. Asset Handling
- **Binary Uploads:** Handle multi-part uploads via the `/api/method/upload_file` endpoint.
- **Real-time:** Subscribe to `frappe.realtime.on('ims_update', callback)` for live workflow status changes on the Kanban board.