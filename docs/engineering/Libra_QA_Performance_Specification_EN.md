# Technical Specification: Libra Bug Testing and Interface Performance Optimization

Date: November 11, 2026. Specification version: 1.0.

## 1. Objective and Scope

Test every implemented Libra feature, identify and fix defects, and eliminate the causes of delays and stuttering throughout the interface. The primary acceptance environment is the installed PWA on a physical iPhone. Also test the browser version.

Expected outcome: the application performs user actions correctly, responds promptly to input, scrolls and turns pages smoothly, and preserves user data and reading positions after closing, updating, and reconnecting.

This specification incorporates previously established Libra requirements. The problem scenarios below are mandatory test cases, not claims that these defects exist in the current release. The current source code and build were not inspected when preparing this specification.

Before starting, inventory the screens, features, storage mechanisms, and synchronization mechanisms actually implemented. Include every feature discovered in the application, even if it is not named here. Mark unimplemented features as absent; this specification does not, by itself, authorize developing them.

Preserve the current design and agreed behavior. Interface changes are permitted to correct identified defects. Do not change page-turning controls, the storage model, or user workflows solely to simplify optimization.

## 2. Preparation and Reproducibility

1. Record the application URL, build and source revision, date, device model, OS and browser versions, launch mode, refresh rate, and power-saving setting.
2. Use a test account and copies of books. Back up data before migrations. Do not delete the user's library, positions, quotations, or statistics to fix bugs or clear caches.
3. Capture baseline performance measurements and videos of key scenarios. Compare before and after using the same devices, books, settings, and network conditions.
4. Test cold launch, subsequent launch, and return from the background separately. Also measure initial book loading separately from reopening a book.
5. Maintain a coverage matrix: feature → scenario → expected result → device → actual result → defect → retest.

## 3. Devices, States, and Test Data

### Environment Matrix

| Environment | Required coverage |
| --- | --- |
| The user's physical iPhone, or a device with equivalent performance, running the PWA | Complete functional test pass and smoothness measurements |
| A lower-performance iPhone within the supported range | Reading, search, import, scrolling, position restoration, and memory |
| Safari on iPhone | All core scenarios, keyboard, and browser toolbars |
| Desktop Chromium | Core functionality, keyboard interaction, and window resizing |
| Other platforms the application claims to support | Core scenarios and platform-specific features |

Record exact devices and versions before acceptance testing. Mobile viewport emulation does not replace testing on a physical iPhone. Explicitly list environments that could not be tested because devices were unavailable.

Test light and dark themes, portrait and landscape orientations, small screens, large text, fractional font sizes of 22.5 and 23.5, the onscreen keyboard, system Reduce Motion, and power-saving mode. Perform baseline measurements with power saving disabled; test that mode separately.

Network conditions: normal connection, slow connection, connection loss during an operation, reconnection, launch without a VPN, and offline operation after resources have been downloaded. Test first launch in a fresh profile without a connection separately; do not assume resources that were never downloaded will be available.

### Books and Libraries

- FB2 and EPUB: a small file up to 5 MB, a medium file of 5–20 MB, and a large file of 20–50 MB. Use files larger than 50 MB as separate stress cases. For each file, also record text volume and the number of chapters and images: file size alone does not describe the workload.
- A long chapter, many short chapters, dialogue, italics, tables where supported, illustrations, nested sections, footnotes, long words, Cyrillic and Latin text, nonbreaking spaces, and line breaks.
- A book without a cover, incomplete metadata, different books with identical titles, repeat import of the same file, a corrupted file, and an unsupported format.
- Libraries containing 0, 1, 50, and 300 books. Establish the normally supported capacity and treat larger libraries as stress tests.
- Prepare reference phrases near page and chapter boundaries, plus a list of known search matches. Verify text completeness using text anchors, not page counts alone.

## 4. Functional Testing

### 4.1. Launch, Navigation, and Home Screen

Test PWA installation and launch, loading after an update, navigation between every section, system back navigation, tapping the active tab again, rapid screen switching, empty states, loading failures, and retry actions.

On the home screen, verify the book list and count, covers, current book, Continue action, and sorting, filters, and library search where implemented. The count must match the library contents. Returning from a book must not reset the list's scroll position without a reason. Importing or deleting a book must update the displayed data without restarting.

Check for invisible overlays, duplicate actions, stuck loading indicators, layout shifts while covers load, and incorrect active button states.

### 4.2. Book Import and Management

Test FB2 and EPUB imports separately, available batch import methods, canceling file selection, repeated imports, large and corrupted files, and backgrounding the application during import.

A book must appear once, open successfully, and contain its complete text and correct table of contents. On failure, the application must explain the reason in understandable language, remain usable, and allow a retry. No empty cards or corrupted records may remain.

Deletion must affect only the selected book and its associated data according to the existing behavior. Test canceling deletion, adding the book again, and library state on another device where synchronization is available. Retrying a network request must not create duplicates.

### 4.3. Reading and Pagination

Test the first and last pages, chapter boundaries, long paragraphs, images, footnotes, and all supported styles. Check for missing or repeated text, unintended blank pages, clipped lines, and content overflowing the screen.

Changing font family, size, spacing, margins, or orientation must preserve the reader's location in the text, even when the page number changes. Verify a stable text anchor rather than just a saved page number.

Specifically test the previously reported two-page position offset: open a book, navigate to a reference phrase, close it, and reopen it. Repeat after changing appearance settings, rotating the device, and updating the application. Page number, progress percentage, and visible text must refer to the same location. Progress must stay within 0–100%, with completion corresponding to the actual end of the book.

### 4.4. Page Turning and Gestures

Preserve both control methods:

- Swipe: the page continuously follows the finger forward and backward. The user can hold it between states, reverse direction, and move it back. Releasing the finger must complete or cancel the gesture correctly.
- Edge tap: immediately show the adjacent page without animation. Center taps control reading panels according to the existing behavior.

Test slow and fast swipes, short movements, diagonal gestures, direction reversals, release outside the starting region, interruption by a system gesture, a second touch, text selection, and frequent alternation between swipes and taps. Book boundaries must prevent navigation to nonexistent pages.

One completed gesture must produce one page turn. A canceled gesture must preserve the position. There must be no white flashes, blank adjacent pages, jumps on release, unintended reverse turns, double turns, or pages stuck between states. Distinguishing a tap from a drag must not make normal taps noticeably slow.

### 4.5. In-Book Search

Test words, phrases, and sentences; the beginning and end of the book; multiple matches within a chapter; and phrases spanning page boundaries, paragraphs, and internal EPUB text nodes. Test case, punctuation, spaces, line breaks, Cyrillic, and Latin text. Define the rules for Russian е/ё equivalence, hyphens, and word boundaries before testing; do not change them silently.

Prepare a reference dataset: query → expected matches and text anchors. Compare both the match count and locations. Highlighting must not change the text, line widths, or pagination. Selecting a result must navigate to the correct passage and allow reading to continue.

Required navigation behavior:

1. Record the original reading position when entering search.
2. After selecting a result, the user can continue reading from that location.
3. Closing search or the bottom panel with the close button preserves the current reading position.
4. Return to the original location only through the explicit Return action.
5. After navigating between several results, Return goes to the position recorded at the start of the current search session, not the previous match.
6. The bottom panel overlays the page. It must not shrink the pagination area or trigger repagination.

Test rapid typing, deleting the query, pasting a long phrase, no matches, repeated queries, closing during a search, and entering a new query before the previous search completes. Stale responses must not replace newer results. Typing and the close button must remain responsive during indexing. Panels and the keyboard must not unexpectedly reset settings or reading position; closing them must restore stable screen geometry.

### 4.6. Settings, Panels, and Footnotes

Test every implemented setting and combinations of settings. Values must apply consistently, persist after restart, and remain unchanged during search. Rapid successive changes must result in the last selected state; an intermediate pagination calculation must not overwrite it.

Panels, dialogs, the table of contents, and footnotes must open and close on the first action. There must be no click-through, stuck backdrops, or lingering scroll locks. After closing, return focus to the triggering element where available. The complete text of a long footnote must be readable; scrolling it must not turn book pages. Test internal links and return navigation.

Buttons and text must not be hidden under the notch, top system controls, iPhone home indicator, or keyboard. Test changes in browser toolbar height. Dark mode must not accidentally darken illustrations and covers through a global filter. Prevent unintended element zooming during interaction; separately verify readability and system accessibility features.

### 4.7. Reading Position, Quotations, Bookmarks, and Reading Time

Test position persistence after normal closing, backgrounding, screen locking, OS process termination, and restart. Switch between two books and confirm that their positions remain independent. Distinguish normal persistence from possible loss of the latest unsaved change after abnormal termination; explicitly document and minimize the acceptable loss window.

Test every implemented quotation, bookmark, and note action: creation, navigation, editing, deletion, copying, long content, and repeated actions. Changing appearance settings must not break links to text passages.

Reading time must accumulate while the book screen is active and the application is in the foreground. Counting must stop when the application enters the background, the screen locks, or the user moves to another section. Define and consistently apply how panels displayed over a book affect time tracking. Opening search must not create a second tracking session. Returning from the background must not add the entire elapsed background interval.

Test reference intervals of 60 seconds and 5 minutes, allowing up to 2 seconds of deviation on the test device without OS interference. Verify the stored value separately from hh:mm display rounding: a short session may display 00:00, but its seconds must be retained. Reading time must not reset or double after restarting, repeated synchronization, or use on two devices.

### 4.8. Offline Use, Authentication, Synchronization, and Updates

After preparing for offline use, test opening and reading downloaded books, search, and local saving without a connection and without a VPN. The application must clearly indicate unavailable network actions while allowing locally available reading.

Test connection loss during synchronization, request retries, session expiration, and sign-in/sign-out where implemented. Different accounts' data must not mix. Test full local storage and failed writes: the application must not report a successful save when saving failed.

On two devices, test concurrent changes to positions, settings, quotations, and statistics; one device operating offline; and deletion on one device while changes occur on the other. Before implementing fixes, document conflict-resolution rules for each data type. An older position must not silently overwrite newer reading progress, reading time must not double, and a deleted book must not reappear spontaneously. Preserve data and provide an explainable resolution for ambiguous conflicts.

Test PWA updates from the previous version to the new version, including local data and cache migration. Updates must not cause reload loops or mix incompatible resources; books, settings, and positions must remain available. Verify that rollback is compatible with data-format changes, or document a safe recovery procedure.

## 5. Measurable Responsiveness and Smoothness Requirements

The following values are project acceptance targets, not claims about Libra's existing performance. Fix the baseline environment and medium reference book before the first measurement. Also report measurements for large books and slower devices; do not conceal deviations behind averages.

| Metric | Target and conditions |
| --- | --- |
| First visible response to a local tap, text input, or panel dismissal | p95 at or below 100 ms |
| Switching between already loaded sections | p95 at or below 300 ms until ready for interaction |
| Page-edge tap | Correct page visible within p95 of 100 ms when the book and adjacent page are ready |
| Reopening a prepared medium book | p95 at or below 1 second until text is readable and input is accepted |
| Search using an existing index of the medium book | p95 at or below 500 ms from query acceptance to available results; report any search-start delay separately |
| First search, including index construction | First results within 2 seconds for the baseline medium book; for a long operation, show an in-progress state within 100 ms and keep input and dismissal available |
| Swipes, scrolling, and panel movement | Stable target of 60 frames/s on the baseline device; assess the 120 Hz budget separately when actually rendering at 120 frames/s |
| Frame pacing | No more than 5% of frame intervals exceed 1.5 times the frame budget during the control interval; no pause in visual movement longer than 50 ms |
| Main-thread blocking | No Libra-related task longer than 50 ms during core gestures and local actions; no uninterrupted block longer than 200 ms during import and indexing |
| Stability | During 60 minutes of mixed use, no crashes, data loss, stuck panels, or sustained memory growth after returning to the same state |

Calculate the frame budget as 1000 divided by the actual target frame rate: approximately 16.7 ms at 60 Hz and 8.3 ms at 120 Hz. Do not assume the display refresh rate and application rendering rate are identical. Average FPS alone is insufficient evidence of smoothness.

For p95, collect at least 30 repetitions of each short scenario, separately before and after changes. Do not combine cold and repeat openings, different devices, or different book sizes into one sample. For gestures, record three 30-second runs covering swipes, direction changes, and scrolling; report slow-frame counts, the longest pause, and the performance profile. Report separate measurements for long imports and stress files even if 30 repetitions are unavailable; do not present those samples as reliable p95 measurements.

If a metric is unavailable on a platform, state the limitation and observation method. Application-level frame timers must not be presented as complete measurements of screen presentation. Use the available browser profiler, event recordings, and video from a physical device; video alone does not substantiate every numerical metric.

## 6. Diagnosis and Optimization

Profile problematic scenarios and establish their causes before changing code. For every substantial fix, connect the symptom, measurement, cause, code change, and repeat measurement. Do not attribute stuttering to React, networking, or pagination without evidence.

Investigate and address the following where profiling confirms them:

- Re-rendering the entire reading screen or library during finger movement or typing; overly broad state subscriptions.
- Interleaved DOM measurements and mutations, forced layout recalculation, expensive painting, and costly filters or shadows.
- Pagination, image loading, book processing, or synchronous storage writes during gestures or on every frame.
- Conflicting CSS transitions and JavaScript animation, multiple animation loops, and timers or handlers accumulating after screens close.
- Late gesture recognition, incorrect touch-cancellation handling, and competition with scrolling or text selection.
- Searching the entire book on every input without canceling obsolete work, or rebuilding an unchanged index.
- Loading all cover images at once, unnecessarily decoding large images, and uncontrolled DOM growth.
- Excess requests, sequential network dependencies, and repeated synchronization of the same change.
- Leaks involving retained DOM nodes, object URLs, listeners, active tasks, and references to closed books.

For gestures, consider requestAnimationFrame and transform updates, preparing adjacent pages, and separating geometry reads from writes. Split heavy computation into smaller units or move it off the main thread where compatible with the existing architecture. Cancel or discard obsolete calculation results. Pagination cache keys must include relevant settings and reading-area dimensions; otherwise, an optimization can produce incorrect pages.

Choose optimizations based on the measured cause. Do not apply will-change, memoization, or virtualization throughout the application without assessing benefits and memory costs. Do not conceal delays by extending animation duration. Optimization must not truncate text, drop taps, or omit data persistence. When system Reduce Motion is enabled, preserve full functionality with minimal animation.

## 7. Execution Order and Priorities

1. Inventory features, prepare test data, and capture baseline measurements.
2. Complete a functional test pass, maintain the defect register, and profile slow scenarios.
3. Fix data loss, incorrect positions, missing text, and broken core functions.
4. Fix gestures, search, panels, and delays based on established causes.
5. Retest every fix and related scenarios; compare before-and-after measurements.
6. Complete full regression testing, an extended session, and offline, synchronization, and PWA update checks.

| Priority | Criteria |
| --- | --- |
| P0 — Blocker | Data loss or corruption, account data mixing, widespread inability to launch or read |
| P1 — High | Incorrect reading position, missing text, broken import or search, double page turns, or freezes during core actions |
| P2 — Medium | Noticeable stuttering, delays, or defects in individual scenarios while the application remains usable |
| P3 — Low | Minor visual defects that do not prevent an action |

Assess severity by consequences, not just the affected feature's name. A stutter that causes an incorrect action or blocks reading may warrant a priority above P2.

## 8. Defect Reports and Deliverables

For every defect, include an ID, short title, priority, version, device and environment, preconditions, test book, exact reproduction steps, expected and actual results, reproduction frequency, video or screenshot, and relevant logs and profiles without secrets or unnecessary user data. After fixing it, add the cause, a link to the change, and retest results for a specific build.

Status flow: found → confirmed → fixed → retested → closed. Reopen any defect that reproduces after its fix.

Deliver:

- A coverage matrix of all discovered features and executed checks, marked Passed, Failed, Blocked, Not tested, or Not applicable.
- A defect register with priorities, statuses, and evidence of fixes.
- Before-and-after performance results: devices, test data, conditions, sample sizes, p95, frame-interval distribution, longest pauses, and memory observations.
- A concise explanation of the main causes of delays and the changes made.
- The URL and identifier of the tested build, PWA update instructions, known limitations, and a safe rollback or data-recovery procedure.

Add targeted automated regression checks where they protect against recurrence: preserving text anchors, searching across EPUB element boundaries, Return and close-button behavior, avoiding repagination when opening panels, and repeat synchronization without doubling reading time. These checks do not replace gesture and smoothness testing on a physical iPhone.

## 9. Acceptance Criteria

The work is accepted when:

1. Every implemented feature is included in the coverage matrix; mandatory scenarios have been executed on the agreed available devices, and coverage gaps are explicitly listed.
2. No P0 or P1 defects remain open. Other defects are listed and are not declared fixed without retesting.
3. Text, reading positions, and user data remain intact after reading, settings changes, restart, offline use, synchronization, and updates.
4. Closing search preserves the selected reading position; Return provides a separate action to restore the original position; the bottom panel does not alter book pagination.
5. Swipes and taps behave as specified, including cancellation and direction changes, without double turns or visual flashes.
6. Performance targets are met on the recorded baseline device and dataset, with before-and-after evidence. Missed targets and untested environments are listed separately and require an acceptance decision.
7. The extended session and full regression pass finish without critical defects or new regressions.

Reducing resolution, making gestures more complicated, disabling features, clearing data, or extending animation duration do not, by themselves, satisfy the smoothness optimization requirement.
