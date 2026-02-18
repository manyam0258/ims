# Skill: Frappe-UI (Component Library & UX)

## 1. Component Usage Standards
- **Layouts:** Use `AppShell` or `Sidebar` components for the main dashboard structure.
- **Data Tables:** Use the `ListView` component for the "All Assets" gallery.
- **Modals:** Use `Dialog` for asset previews and annotation inputs.

## 2. Resource Management
- **createResource:** Use the `createResource` hook for fetching single DocTypes (e.g., a specific Asset).
- **listResource:** Use `listResource` for the Kanban board columns to enable easy filtering by `workflow_state`.

## 3. Styling & Theming
- **Tailwind CSS:** All custom components must use Tailwind utility classes.
- **Consistency:** Follow the Frappe "Gray/Blue" color palette.
- **Responsiveness:** Ensure the `UploadPortal` and `KanbanBoard` are mobile-responsive using Tailwind's `sm:`, `md:`, and `lg:` prefixes.

## 4. Custom Component: IMS Annotation
- **Tech:** HTML5 Canvas overlay.
- **Interaction:**
    - On click: Open a `frappe-ui` `Popover` to enter a comment.
    - Save: Dispatch an API call to save JSON coordinates to the backend.
- **Visuals:** Use `frappe-ui` icons for "Approve" (Check icon) and "Reject" (X icon) buttons in the dashboard.