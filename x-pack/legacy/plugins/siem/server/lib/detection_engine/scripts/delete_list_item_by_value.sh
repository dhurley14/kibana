#!/bin/sh

#
# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License;
# you may not use this file except in compliance with the Elastic License.
#

set -e
./check_env_variables.sh

# Example: ./delete_list_item_by_value.sh?list_id=${some_id}&value=${some_ip}
curl -s -k \
 -H 'kbn-xsrf: 123' \
 -u ${ELASTICSEARCH_USERNAME}:${ELASTICSEARCH_PASSWORD} \
 -X DELETE "${KIBANA_URL}${SPACE_URL}/api/detection_engine/lists/items?list_id=$1&value=$2" | jq .
