# Rotation IQ

A live basketball rotation coach built around **positional structure**, not simple equal-minute substitution.

## What is in the first build

- **PG / SG / SF / PF / C** lineup model
- Natural-position roster setup
- Coach-controlled **HOT**, **REST** and **FOUL** tags
- Positional substitution recommendations
- Minutes, stint and rest tracking
- **Rep 4 × 10** and **Domestic 2 × 18** game modes
- Live game clock and score
- Undo / redo
- Local game persistence
- Substitution timeline
- Responsive iPad/mobile-friendly interface

## Default roster

- Rodion — PF/C
- Jacob — PF/C
- Archer — SG/SF
- Max — SG/SF
- Bill — PG/SG/SF/PF
- Alvin — PG/SG/SF
- Ethan — SF/PF
- Tom — PG/SG/SF
- Tate — SG/SF/PF

## Rotation philosophy

The engine currently prioritises:

1. Positional structure
2. Coach REST / FOUL instructions
3. Protecting a HOT player
4. Workload and minutes balance
5. Player rest and stint length

The coach always remains in control. Recommendations are suggestions, not automatic substitutions.

## Deployment

The project is framework-free and can be hosted as a static site, including GitHub Pages.
