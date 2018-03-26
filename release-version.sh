#!/bin/bash

if [ -z "$*" ];
    then echo "Please specify: major|minor|patch"
    exit 1
fi

type="$@"

npm version "$type"
git push --tags
git push

echo "Done."

