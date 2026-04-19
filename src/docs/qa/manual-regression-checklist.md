# Manual Regression Checklist

Use this checklist before each release to verify critical flows.

## Boot & Navigation

- [ ] App boots without console errors
- [ ] Sidebar navigation switches between all views
- [ ] Mobile sidebar opens/closes correctly
- [ ] Theme switching works for all 7 themes
- [ ] Back/forward browser navigation works

## Events (Estudo)

- [ ] Create new study event
- [ ] Edit existing event
- [ ] Delete event with confirmation
- [ ] Timer starts, pauses, and finishes
- [ ] Timer sound notification plays
- [ ] Event persists after page refresh

## Calendar

- [ ] Calendar renders current month
- [ ] Week view toggles correctly
- [ ] Mobile calendar view works
- [ ] Clicking a date shows events for that day

## Revisions

- [ ] Pending revisions appear on dashboard
- [ ] Completing a revision schedules next one
- [ ] Revision streak counter updates

## Editais

- [ ] Create new edital
- [ ] Add disciplines and subjects
- [ ] Edit edital details
- [ ] Delete edital with confirmation
- [ ] Vertical view renders correctly

## Dashboard

- [ ] Stats display correctly (events, hours, streak)
- [ ] Charts render without errors
- [ ] Filter tabs work

## Sync

- [ ] Cloudflare sync push succeeds with valid credentials
- [ ] Cloudflare sync pull succeeds
- [ ] Sync fails gracefully with invalid credentials
- [ ] Google Drive sync flow works (if configured)

## Offline & PWA

- [ ] App loads offline after first visit
- [ ] Install prompt appears on supported browsers
- [ ] App works in standalone mode

## Accessibility

- [ ] Tab navigation reaches all interactive elements
- [ ] Modals trap focus correctly
- [ ] ESC closes modals
- [ ] Screen reader announces key actions

## Responsive

- [ ] Layout works at 1280px, 1024px, 768px, 480px
- [ ] Touch targets are adequate on mobile
- [ ] No horizontal overflow
