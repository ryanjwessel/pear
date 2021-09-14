#!/bin/bash

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2
SHA1=$3

filename='./.pear/session'

if [ ! -f "$filename" ]; then
    # If the Pear session file does not exist, then there is no session.
    exit 0;
fi

if [ "$SHA1" ]; then
    # If SHA1 exists, we are amending a commit. Don't modify the message.
    exit 0;
fi

coauthors="Co-authors: $(paste -s $filename | sed -e 's/\t/, /g' -e 's/, $//')"

if [[ "$COMMIT_SOURCE" == "message" ]]; then
    # Append coauthors if user has provided a shorthand commit message
    echo "$(cat $COMMIT_MSG_FILE)\n\n${coauthors}\n" > "$COMMIT_MSG_FILE"
else
    # Prepend coauthors if user is using the commit editor
    echo "\n\n${coauthors}\n$(cat $COMMIT_MSG_FILE)" > "$COMMIT_MSG_FILE"
fi
