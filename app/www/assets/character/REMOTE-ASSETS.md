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
