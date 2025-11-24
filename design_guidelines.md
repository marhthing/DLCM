# Church Live Stream Attendance App - Design Guidelines

## Design Approach
**Selected Approach:** Design System - Material Design with spiritual warmth  
**Rationale:** This is a utility-focused application requiring clear data presentation, reliable forms, and trustworthy UI patterns. Material Design provides the structure needed for tables and forms while allowing warmth through typography and spacing.

## Core Design Elements

### Typography
**Font Family:** 
- Primary: Inter or SF Pro Display (via Google Fonts CDN)
- Headings: 600-700 weight for authority and clarity
- Body: 400-500 weight for comfortable reading

**Hierarchy:**
- Page Titles: text-3xl (30px) font-bold
- Section Headers: text-xl (20px) font-semibold
- Body Text: text-base (16px) font-normal
- Form Labels: text-sm (14px) font-medium
- Metadata/Timestamps: text-sm (14px) font-normal

### Layout System
**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-4 to p-8
- Section spacing: py-8 to py-12
- Element gaps: gap-4 to gap-6
- Container max-width: max-w-7xl for main content, max-w-md for forms

**Grid Structure:**
- Login/Admin forms: Single column, centered, max-w-md
- Stream page: Full-width video player with max-w-7xl container
- Admin dashboard: Single column layout with full-width tables

### Component Library

**Login Screen:**
- Centered card layout (max-w-md)
- Rounded container: rounded-2xl with shadow-xl
- Icon container: 64px circle with icon centered
- Input fields: Full-width with px-4 py-3, rounded-lg borders
- Primary CTA: Full-width, py-3, rounded-lg
- Footer link: Small, underlined on hover

**Stream Player Page:**
- Top bar: Full-width sticky header with user info and status indicator
- Video container: aspect-video ratio, rounded-lg, with shadow-2xl for prominence
- Info card below: rounded-lg with p-6 padding
- User status badge: Inline with icon + text combination

**Admin Dashboard:**
- Navigation header: Full-width with shadow, py-4 padding
- Card sections: bg-white, rounded-lg, shadow, p-6
- Form sections: Clear labels above inputs with mb-2 spacing
- Data table: Full-width with alternating row treatment, sticky header
- Action buttons: Inline with sections, right-aligned for secondary actions

**Tables (Admin):**
- Header row: Slightly elevated treatment, font-semibold, text-left alignment
- Cell padding: px-4 py-3 for comfortable data scanning
- Responsive: Horizontal scroll on mobile (overflow-x-auto)
- Empty state: Centered message with py-8

**Forms:**
- Label above input pattern throughout
- Input height: py-3 for touch-friendly targets
- Focus states: ring-2 treatment
- Button heights: py-3 for primary actions, py-2 for secondary

**Status Indicators:**
- Inline icon + text pattern for attendance recording
- Success states: Checkmark icon leading
- Icon size: 20-24px for inline, 32px for hero icons

### Visual Hierarchy

**Elevation Layers:**
1. Background: Gradient treatment for login/admin login
2. Cards: shadow-xl for primary content cards
3. Video player: shadow-2xl for emphasis
4. Navigation: shadow for header separation
5. Modals/overlays: (if added) shadow-2xl

**Density:**
- Login screens: Generous whitespace, mb-8 between sections
- Stream page: Comfortable spacing, content doesn't feel cramped
- Admin tables: Efficient but readable, adequate cell padding
- Forms: mb-4 to mb-6 between fields

### Component States
- Default: Clean, clear borders
- Hover: Subtle background shifts for buttons only
- Focus: Ring treatment (ring-2) for inputs
- Active: No state changes during interaction
- Disabled: Reduced opacity treatment

### Responsive Behavior
- Mobile (base): Single column, full-width inputs, stacked navigation
- Tablet (md): Maintain single column for forms, optimize table scrolling
- Desktop (lg): Max-width containers, comfortable whitespace

### Images
**Hero Icons (not photos):**
- Login page: YouTube icon in circular container, 64px
- Admin login: Settings icon in circular container, 64px
- Use lucide-react icon library (already imported in code)

**No photographic images needed** - This is a utility application focused on functionality. Icons provide sufficient visual interest and clarity.

### Specific Page Layouts

**Login/Admin Login Pages:**
- Full viewport height with centered content
- Gradient background for visual interest
- Card: 8-unit padding, centered, max-width 28rem
- Icon circle at top, title below, description text, then form
- Spacing: mb-8 between major sections, mb-4 between form fields

**Stream Page:**
- Dark theme treatment for video viewing comfort
- Sticky header with user confirmation
- Video: Full width of container, 16:9 aspect ratio
- Information card below with welcoming message and instructions

**Admin Dashboard:**
- Light background for data readability
- Header with title and logout action
- Cards for different sections (YouTube settings, attendance table)
- Table with export functionality prominently placed
- Generous spacing between sections (space-y-6)

### Key Interaction Patterns
- Single-click actions for all primary flows
- Clear visual feedback for form submission
- Table export as prominent secondary action
- Admin password as simple protection (not production auth)
- Attendance tracking happens silently in background

### Accessibility
- All inputs have visible labels
- Sufficient contrast throughout
- Touch targets minimum 44px height (achieved with py-3)
- Focus indicators on all interactive elements
- Semantic HTML structure maintained