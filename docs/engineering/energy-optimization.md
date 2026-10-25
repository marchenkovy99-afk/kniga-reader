# Reader energy optimization — 2026-10-25
User authorized optimization and publication following the read-only audit.

- Full cloud pulls every120 seconds in reader /60 in library; also on startup, foreground, online recovery and explicit requests. Remote changes may take up to two minutes while continuously reading.
- Locally durable position edits debounce five seconds; appearance edits1.2 seconds. Lightweight upload verifies account identity and sends only pending states; it does not fetch books/states again. Each mutation checks expected account owner at the transport boundary.
- Hide/offline pauses scheduled work; hide attempts one final lightweight upload. iOS may suspend it: durable pending edits resume on foreground.
- Retry backoff15/30/60/120/240/300 seconds, with no competing periodic timer during failures. Successful retries reactivate polling.
- Skip unchanged remote progress writes and already-sent duplicate queue records.

Verification: full suite, syntax/types, Pages build, mobile browser selection/navigation/annotation scenario; instrumented35-second idle-browser comparison against prior audit. Physical iPhone battery percentage not measured. Independent review found missing polling after startup recovery, overlapping retry/poll timing, and missing library cadence reset; all addressed.
