Behavior Dashboard Module

Files:
- behavior-dashboard.css
- behavior-dashboard.js
- demo.html
- integration-snippet.html

What this module does:
- Reads behavior events from localStorage by default.
- Safely renders inside one wrapper div.
- Does not modify your existing app files or data files.
- Can also accept a direct events array.

Expected localStorage key:
- seating_viewer_behavior_log_v1

Expected event shape:
- loggedAt or timestamp
- studentName
- studentNumber or studentId
- periodId
- seatId
- tableId
- zone
- position
- modeId
- categoryId
- behaviorId
- label
- score

Public API:
- BehaviorBentoDashboard.mount(selectorOrElement, options)
- instance.refresh()
- instance.setEvents(events)
- instance.destroy()

Design sections:
- Pulse Score
- Mode Balance
- Behavior Pressure Map
- Student Impact Ladder
- Zone / Table Heat
- Timeline Ribbon
