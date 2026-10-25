# Progress: book layout plan
User approved the preceding concrete improvement proposal and instructed execution while preserving settings; added three QA cycles. Proceed without another confirmation.
Task 1: in progress.
Tasks 1-3: implemented. Semantic import, compatible local upgrade, cache v4, measured layout and source-preserving glue pass unit and browser tests.
QA cycle 1: independent tester found CSS statement at-rules swallowing next rule and conditional CSS becoming unconditional. Both reproduced in qa-import-regressions.test.mjs; replaced regex with bounded balanced-rule scanner. Suite now includes these regressions.
QA cycle 2: independent mobile tester found old continued-prose CSS overriding verse/preformatted/attribution final-line alignment. Added explicit semantic overrides with matching selector specificity. QA regression now passes 48 configurations and exact source/selection coordinates; mixed night-theme screenshot inspected. Original four browser flows pass.
QA cycle 3: independent final tester passed 102 units/check/full build/Pages build, original browser flows, 48 semantic configs and 24 adversarial Unicode/long-word configs. Found conventional XHTML PUBLIC declarations/named entities rejected; added focused unit RED then safe prolog-only declaration removal and bounded entity mapping, preserving literal CDATA. Native browser XML test verifies no external requests and rejects actual entity definitions. Final units 103 pass; check and Pages build pass.
Ruling: keep conditional EPUB CSS unsupported rather than turning print/media rules into unconditional screen styles; base presentation and user typography stay in control.
Minor deferred: 240px viewport with font48, indent3em, max spacing3px and max margins can overflow by 2px on an emoji; tested phone widths 280–393 pass. Do not silently change the user's stored indent to hide this extreme legacy edge.
Physical iPhone remains unverified; no claim of full commercial-engine parity.
