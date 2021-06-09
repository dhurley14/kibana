#!/bin/sh
#
# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License
# 2.0; you may not use this file except in compliance with the Elastic License
# 2.0.
#

curl -s -k \ 
     -u ${ELASTICSEARCH_USERNAME}:${ELASTICSEARCH_PASSWORD} \
     -H 'Content-Type: application/json' \
     -H 'kbn-xsrf: 123' \
     -X POST ${KIBANA_URL}${SPACE_URL}/api/alerts/alert \
     -d '
{
  "params":{
     "indexPatterns": ["*"],
     "customQuery": "*:*",
     "thresholdFields": ["source.ip", "destination.ip"],
     "thresholdValue": 50,
     "thresholdCardinality": []
   },
   "consumer":"alerts",
   "alertTypeId":"siem.thresholdRule",
   "schedule":{
      "interval":"1m"
   },
   "actions":[],
   "tags":[
      "persistence",
      "threshold"
   ],
   "notifyWhen":"onActionGroupChange",
   "name":"Basic Threshold rule"
}'


