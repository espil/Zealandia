# Character assets are remote assets

The character GLBs (about 338MB in the web deploy copy) are NOT bundled
into this app. They ship as downloadable / remote assets, matching the
recorded plan to move the character GLBs to object storage instead of
keeping them in the app binary or the git repo.

For a local full test that needs the characters in place, run:

  npm run sync:full

That copies assets/character/ from the web deploy copy into www/.
Do not ship a store build made from a full sync until the remote
asset delivery path replaces the bundled GLBs.

UPDATE (Han order, 2026-10-23): the two BASE models are bundled after
all - male.glb and female_idle.glb. Without a base model the avatar
loader failed outright ("Character failed to load", no character on
screen), which Han hit in his run check. The base GLBs carry the
embedded idle/walk/run set, so the character stands, walks and runs;
the per-action clip GLBs stay remote as above until the remote
delivery path lands.
