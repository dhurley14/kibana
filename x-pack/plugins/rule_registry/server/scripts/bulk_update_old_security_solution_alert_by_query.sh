#!/bin/sh

#
# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License
# 2.0; you may not use this file except in compliance with the Elastic License
# 2.0.
#

set -e

QUERY=${1:-"signal.status: open"}
STATUS=${2}

echo $IDS
echo "'"$STATUS"'"

cd ./hunter && sh ./post_detections_role.sh && sh ./post_detections_user.sh
cd ../observer && sh ./post_detections_role.sh && sh ./post_detections_user.sh
cd ..

# Example: ./update_observability_alert.sh "kibana.rac.alert.stats: open" <closed | open>
curl -s -k \
 -H 'Content-Type: application/json' \
 -H 'kbn-xsrf: 123' \
 -u hunter:changeme \
 -X POST ${KIBANA_URL}${SPACE_URL}/internal/rac/alerts/bulk_update \
 -d "{\"ids\": [\"7e5bf32b8aa1a96b835200d8a6aad39079f03257129ad238a828152884690c86\"], \"status\":\"$STATUS\", \"index\":\".siem-signals-devin-hurley-default\"}" | jq .

# -d "{\"query\": {\"bool\": {
#     \"filter\": {
#       \"terms\": {
#         \"_id\": [         \"7e5bf32b8aa1a96b835200d8a6aad39079f03257129ad238a828152884690c86\"
#         ]
#       }
#     }
#   }}, \"status\":\"$STATUS\", \"index\":\".siem-signals-devin-hurley-default\"}" | jq .


# 824ec1a1c9a0fcded6063e88353b828e414149b37f6d7cbe47a038d08aaa3285