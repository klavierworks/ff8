#!/bin/sh
# The site build carries no extractor files, so the Netlify upload is the build with the
# extractor output placed beside it at data/. `cp -c` clones on APFS, so no data is duplicated.
set -e

rm -rf deploy
cp -Rc dist deploy
cp -Rc extractor/data/converted deploy/data
rm -rf deploy/data/types
