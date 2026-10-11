# Table/Row vs custom rows: audit result

Verdict: both needed at different levels. Table/Row should be the ONE base row; named rows are built from it. Today they are two separate drawings of the same row, and 12 custom rows are only colour/state variants.

Evidence
- 78 Table/Row instances: 66 on older dark screens (each replaces cell area jQnr2 with Table/Cell instances, overrides padding 20, fill, border, height 36/58); 12 = 8 state demos on light sheet, 2 in Row/episode-details, 2 in Table.
- Custom rows redraw from scratch (except Row/episode-details a3FdOt which nests Table/Header + Table/Row).
- Same base: Row/history, Row/episode, Row/release share height 34, padding 0/12, gap 12, $row fill, $seam bottom border. Status rows only change padding to 20. Real differences: height (30/40/52/56/64) and column widths. Same $font-data 12-13px.
- Table emjuh used on 12 screens, 10 replace all content (just a bordered box). Table/Header sits above Row/release on light Pick a release.
- 20 status-screen rows (download/health/flagged/blocklist/import-file) never used outside sheet c7oDN.

Proposed structure
- Base set: Table, Table/Header, Table/Row, Table/Cell.
- Named rows as instances of the base row with cells filled: release, episode, season, second-version, history, download, health-problem, flagged, blocklist, import-file, import-file-group.
- Delete state copies; show state as override on base row (selected = accent-soft fill + marker bar; risk; warning; error; stalled; import-blocked; waiting). Old ids: F72O5, iy5d8, r3ZRkv, yaoQO, FKDjE, S8DZEY, IGSe3, D5MVY, oMPtX, I8Nm1E, dVtiw, IoJTN.
- Keep outside table family (list items): Row/search-result, Row/release-phone, Row/episode-phone, Row/option-radio, Row/option-checkbox.
- Health summary/stat/disk rows: compare to Fact/row aH6Z5 before merging.
- One horizontal row padding everywhere.

Code today: @tanstack/react-table 9.2.6 installed but unused; only components/ui/button.tsx exists; each screen hand-writes rows as divs with role=table/row; EpisodeDetails.tsx uses a real <table>; PickRelease.tsx is a listbox. Target: shadcn table.tsx + TanStack column defs per named row, state via data-state attribute.
