/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DocLinksStart } from '@kbn/core/public';

class DocLinks {
  public apiKeys: string;
  public appSearchAdaptiveRelevance: string;
  public appSearchApiClients: string;
  public appSearchApiKeys: string;
  public appSearchApis: string;
  public appSearchAuthentication: string;
  public appSearchCrawlRules: string;
  public appSearchCurations: string;
  public appSearchDuplicateDocuments: string;
  public appSearchElasticsearchIndexedEngines: string;
  public appSearchEntryPoints: string;
  public appSearchGettingStarted: string;
  public appSearchGuide: string;
  public appSearchIndexingDocs: string;
  public appSearchIndexingDocsSchema: string;
  public appSearchLogSettings: string;
  public appSearchMetaEngines: string;
  public appSearchPrecision: string;
  public appSearchRelevance: string;
  public appSearchResultSettings: string;
  public appSearchSearchUI: string;
  public appSearchSecurity: string;
  public appSearchSynonyms: string;
  public appSearchWebCrawler: string;
  public appSearchWebCrawlerEventLogs: string;
  public appSearchWebCrawlerReference: string;
  public bulkApi: string;
  public clientsGoIndex: string;
  public clientsGuide: string;
  public clientsJavaBasicAuthentication: string;
  public clientsJavaInstallation: string;
  public clientsJavaIntroduction: string;
  public clientsJavaRestLow: string;
  public clientsJsClientConnecting: string;
  public clientsJsIntro: string;
  public clientsNetIntroduction: string;
  public clientsNetNest: string;
  public clientsNetSingleNode: string;
  public clientsPerlGuide: string;
  public clientsPhpConnecting: string;
  public clientsPhpGuide: string;
  public clientsPhpInstallation: string;
  public clientsPhpOverview: string;
  public clientsPythonAuthentication: string;
  public clientsPythonOverview: string;
  public clientsRubyAuthentication: string;
  public clientsRubyOverview: string;
  public clientsRustOverview: string;
  public cloudIndexManagement: string;
  public connectors: string;
  public crawlerGettingStarted: string;
  public crawlerManaging: string;
  public crawlerOverview: string;
  public elasticsearchCreateIndex: string;
  public elasticsearchGettingStarted: string;
  public elasticsearchMapping: string;
  public enterpriseSearchConfig: string;
  public enterpriseSearchMailService: string;
  public enterpriseSearchTroubleshootSetup: string;
  public enterpriseSearchUsersAccess: string;
  public kibanaSecurity: string;
  public languageAnalyzers: string;
  public languageClients: string;
  public licenseManagement: string;
  public pluginsIngestAttachment: string;
  public queryDsl: string;
  public searchUIAppSearch: string;
  public searchUIElasticsearch: string;
  public start: string;
  public workplaceSearchApiKeys: string;
  public workplaceSearchBox: string;
  public workplaceSearchConfluenceCloud: string;
  public workplaceSearchConfluenceCloudConnectorPackage: string;
  public workplaceSearchConfluenceServer: string;
  public workplaceSearchContentSources: string;
  public workplaceSearchCustomConnectorPackage: string;
  public workplaceSearchCustomSourcePermissions: string;
  public workplaceSearchCustomSources: string;
  public workplaceSearchDocumentPermissions: string;
  public workplaceSearchDropbox: string;
  public workplaceSearchExternalIdentities: string;
  public workplaceSearchExternalSharePointOnline: string;
  public workplaceSearchGettingStarted: string;
  public workplaceSearchGitHub: string;
  public workplaceSearchGmail: string;
  public workplaceSearchGoogleDrive: string;
  public workplaceSearchIndexingSchedule: string;
  public workplaceSearchJiraCloud: string;
  public workplaceSearchJiraServer: string;
  public workplaceSearchNetworkDrive: string;
  public workplaceSearchOneDrive: string;
  public workplaceSearchOutlook: string;
  public workplaceSearchPermissions: string;
  public workplaceSearchPrivateSourcePermissions: string;
  public workplaceSearchSalesforce: string;
  public workplaceSearchSecurity: string;
  public workplaceSearchServiceNow: string;
  public workplaceSearchSharePoint: string;
  public workplaceSearchSharePointServer: string;
  public workplaceSearchSlack: string;
  public workplaceSearchSynch: string;
  public workplaceSearchTeams: string;
  public workplaceSearchZendesk: string;
  public workplaceSearchZoom: string;

  constructor() {
    this.apiKeys = '';
    this.appSearchAdaptiveRelevance = '';
    this.appSearchApis = '';
    this.appSearchApiClients = '';
    this.appSearchApiKeys = '';
    this.appSearchAuthentication = '';
    this.appSearchCrawlRules = '';
    this.appSearchCurations = '';
    this.appSearchDuplicateDocuments = '';
    this.appSearchEntryPoints = '';
    this.appSearchElasticsearchIndexedEngines = '';
    this.appSearchGettingStarted = '';
    this.appSearchGuide = '';
    this.appSearchIndexingDocs = '';
    this.appSearchIndexingDocsSchema = '';
    this.appSearchLogSettings = '';
    this.appSearchMetaEngines = '';
    this.appSearchPrecision = '';
    this.appSearchRelevance = '';
    this.appSearchResultSettings = '';
    this.appSearchSearchUI = '';
    this.appSearchSecurity = '';
    this.appSearchSynonyms = '';
    this.appSearchWebCrawler = '';
    this.appSearchWebCrawlerEventLogs = '';
    this.appSearchWebCrawlerReference = '';
    this.bulkApi = '';
    this.clientsGoIndex = '';
    this.clientsGuide = '';
    this.clientsJavaBasicAuthentication = '';
    this.clientsJavaInstallation = '';
    this.clientsJavaIntroduction = '';
    this.clientsJavaRestLow = '';
    this.clientsJsIntro = '';
    this.clientsJsClientConnecting = '';
    this.clientsNetIntroduction = '';
    this.clientsNetNest = '';
    this.clientsNetSingleNode = '';
    this.clientsPerlGuide = '';
    this.clientsPhpConnecting = '';
    this.clientsPhpGuide = '';
    this.clientsPhpInstallation = '';
    this.clientsPhpOverview = '';
    this.clientsPythonAuthentication = '';
    this.clientsPythonOverview = '';
    this.clientsRubyAuthentication = '';
    this.clientsRubyOverview = '';
    this.clientsRustOverview = '';
    this.cloudIndexManagement = '';
    this.connectors = '';
    this.crawlerGettingStarted = '';
    this.crawlerManaging = '';
    this.crawlerOverview = '';
    this.elasticsearchCreateIndex = '';
    this.elasticsearchGettingStarted = '';
    this.elasticsearchMapping = '';
    this.enterpriseSearchConfig = '';
    this.enterpriseSearchMailService = '';
    this.enterpriseSearchTroubleshootSetup = '';
    this.enterpriseSearchUsersAccess = '';
    this.kibanaSecurity = '';
    this.languageAnalyzers = '';
    this.languageClients = '';
    this.licenseManagement = '';
    this.pluginsIngestAttachment = '';
    this.queryDsl = '';
    this.searchUIAppSearch = '';
    this.searchUIElasticsearch = '';
    this.start = '';
    this.workplaceSearchApiKeys = '';
    this.workplaceSearchBox = '';
    this.workplaceSearchConfluenceCloud = '';
    this.workplaceSearchConfluenceCloudConnectorPackage = '';
    this.workplaceSearchConfluenceServer = '';
    this.workplaceSearchContentSources = '';
    this.workplaceSearchCustomConnectorPackage = '';
    this.workplaceSearchCustomSources = '';
    this.workplaceSearchCustomSourcePermissions = '';
    this.workplaceSearchDocumentPermissions = '';
    this.workplaceSearchDropbox = '';
    this.workplaceSearchExternalSharePointOnline = '';
    this.workplaceSearchExternalIdentities = '';
    this.workplaceSearchGettingStarted = '';
    this.workplaceSearchGitHub = '';
    this.workplaceSearchGmail = '';
    this.workplaceSearchGoogleDrive = '';
    this.workplaceSearchIndexingSchedule = '';
    this.workplaceSearchJiraCloud = '';
    this.workplaceSearchJiraServer = '';
    this.workplaceSearchNetworkDrive = '';
    this.workplaceSearchOneDrive = '';
    this.workplaceSearchOutlook = '';
    this.workplaceSearchPermissions = '';
    this.workplaceSearchPrivateSourcePermissions = '';
    this.workplaceSearchSalesforce = '';
    this.workplaceSearchSecurity = '';
    this.workplaceSearchServiceNow = '';
    this.workplaceSearchSharePoint = '';
    this.workplaceSearchSharePointServer = '';
    this.workplaceSearchSlack = '';
    this.workplaceSearchSynch = '';
    this.workplaceSearchTeams = '';
    this.workplaceSearchZendesk = '';
    this.workplaceSearchZoom = '';
  }

  public setDocLinks(docLinks: DocLinksStart): void {
    this.apiKeys = docLinks.links.enterpriseSearch.apiKeys;
    this.appSearchAdaptiveRelevance = docLinks.links.appSearch.adaptiveRelevance;
    this.appSearchApis = docLinks.links.appSearch.apiRef;
    this.appSearchApiClients = docLinks.links.appSearch.apiClients;
    this.appSearchApiKeys = docLinks.links.appSearch.apiKeys;
    this.appSearchAuthentication = docLinks.links.appSearch.authentication;
    this.appSearchCrawlRules = docLinks.links.appSearch.crawlRules;
    this.appSearchCurations = docLinks.links.appSearch.curations;
    this.appSearchDuplicateDocuments = docLinks.links.appSearch.duplicateDocuments;
    this.appSearchElasticsearchIndexedEngines =
      docLinks.links.appSearch.elasticsearchIndexedEngines;
    this.appSearchEntryPoints = docLinks.links.appSearch.entryPoints;
    this.appSearchGettingStarted = docLinks.links.appSearch.gettingStarted;
    this.appSearchGuide = docLinks.links.appSearch.guide;
    this.appSearchIndexingDocs = docLinks.links.appSearch.indexingDocuments;
    this.appSearchIndexingDocsSchema = docLinks.links.appSearch.indexingDocumentsSchema;
    this.appSearchLogSettings = docLinks.links.appSearch.logSettings;
    this.appSearchMetaEngines = docLinks.links.appSearch.metaEngines;
    this.appSearchPrecision = docLinks.links.appSearch.precisionTuning;
    this.appSearchRelevance = docLinks.links.appSearch.relevanceTuning;
    this.appSearchResultSettings = docLinks.links.appSearch.resultSettings;
    this.appSearchSearchUI = docLinks.links.appSearch.searchUI;
    this.appSearchSecurity = docLinks.links.appSearch.security;
    this.appSearchSynonyms = docLinks.links.appSearch.synonyms;
    this.appSearchWebCrawler = docLinks.links.appSearch.webCrawler;
    this.appSearchWebCrawlerEventLogs = docLinks.links.appSearch.webCrawlerEventLogs;
    this.appSearchWebCrawlerReference = docLinks.links.appSearch.webCrawlerReference;
    this.bulkApi = docLinks.links.enterpriseSearch.bulkApi;
    this.clientsGoIndex = docLinks.links.clients.goIndex;
    this.clientsGuide = docLinks.links.clients.guide;
    this.clientsJavaBasicAuthentication = docLinks.links.clients.javaBasicAuthentication;
    this.clientsJavaInstallation = docLinks.links.clients.javaInstallation;
    this.clientsJavaIntroduction = docLinks.links.clients.javaIntroduction;
    this.clientsJavaRestLow = docLinks.links.clients.javaRestLow;
    this.clientsJsClientConnecting = docLinks.links.clients.jsClientConnecting;
    this.clientsJsIntro = docLinks.links.clients.jsIntro;
    this.clientsNetIntroduction = docLinks.links.clients.netIntroduction;
    this.clientsNetNest = docLinks.links.clients.netNest;
    this.clientsNetSingleNode = docLinks.links.clients.netSingleNode;
    this.clientsPerlGuide = docLinks.links.clients.perlGuide;
    this.clientsPhpConnecting = docLinks.links.clients.phpConnecting;
    this.clientsPhpGuide = docLinks.links.clients.phpGuide;
    this.clientsPhpInstallation = docLinks.links.clients.phpInstallation;
    this.clientsPhpOverview = docLinks.links.clients.phpOverview;
    this.clientsPythonAuthentication = docLinks.links.clients.pythonAuthentication;
    this.clientsPythonOverview = docLinks.links.clients.pythonOverview;
    this.clientsRubyAuthentication = docLinks.links.clients.rubyAuthentication;
    this.clientsRubyOverview = docLinks.links.clients.rubyOverview;
    this.clientsRustOverview = docLinks.links.clients.rustOverview;
    this.cloudIndexManagement = docLinks.links.cloud.indexManagement;
    this.connectors = docLinks.links.enterpriseSearch.connectors;
    this.crawlerGettingStarted = docLinks.links.enterpriseSearch.crawlerGettingStarted;
    this.crawlerManaging = docLinks.links.enterpriseSearch.crawlerManaging;
    this.crawlerOverview = docLinks.links.enterpriseSearch.crawlerOverview;
    this.elasticsearchCreateIndex = docLinks.links.elasticsearch.createIndex;
    this.elasticsearchGettingStarted = docLinks.links.elasticsearch.gettingStarted;
    this.elasticsearchMapping = docLinks.links.elasticsearch.mapping;
    this.enterpriseSearchConfig = docLinks.links.enterpriseSearch.configuration;
    this.enterpriseSearchMailService = docLinks.links.enterpriseSearch.mailService;
    this.enterpriseSearchTroubleshootSetup = docLinks.links.enterpriseSearch.troubleshootSetup;
    this.enterpriseSearchUsersAccess = docLinks.links.enterpriseSearch.usersAccess;
    this.kibanaSecurity = docLinks.links.kibana.xpackSecurity;
    this.languageAnalyzers = docLinks.links.enterpriseSearch.languageAnalyzers;
    this.languageClients = docLinks.links.enterpriseSearch.languageClients;
    this.licenseManagement = docLinks.links.enterpriseSearch.licenseManagement;
    this.pluginsIngestAttachment = docLinks.links.plugins.ingestAttachment;
    this.queryDsl = docLinks.links.query.queryDsl;
    this.searchUIAppSearch = docLinks.links.searchUI.appSearch;
    this.searchUIElasticsearch = docLinks.links.searchUI.elasticsearch;
    this.start = docLinks.links.enterpriseSearch.start;
    this.workplaceSearchApiKeys = docLinks.links.workplaceSearch.apiKeys;
    this.workplaceSearchBox = docLinks.links.workplaceSearch.box;
    this.workplaceSearchConfluenceCloud = docLinks.links.workplaceSearch.confluenceCloud;
    this.workplaceSearchConfluenceCloudConnectorPackage =
      docLinks.links.workplaceSearch.confluenceCloudConnectorPackage;
    this.workplaceSearchConfluenceServer = docLinks.links.workplaceSearch.confluenceServer;
    this.workplaceSearchContentSources = docLinks.links.workplaceSearch.contentSources;
    this.workplaceSearchCustomConnectorPackage =
      docLinks.links.workplaceSearch.customConnectorPackage;
    this.workplaceSearchCustomSources = docLinks.links.workplaceSearch.customSources;
    this.workplaceSearchCustomSourcePermissions =
      docLinks.links.workplaceSearch.customSourcePermissions;
    this.workplaceSearchDocumentPermissions = docLinks.links.workplaceSearch.documentPermissions;
    this.workplaceSearchDropbox = docLinks.links.workplaceSearch.dropbox;
    this.workplaceSearchExternalSharePointOnline =
      docLinks.links.workplaceSearch.externalSharePointOnline;
    this.workplaceSearchExternalIdentities = docLinks.links.workplaceSearch.externalIdentities;
    this.workplaceSearchGettingStarted = docLinks.links.workplaceSearch.gettingStarted;
    this.workplaceSearchGitHub = docLinks.links.workplaceSearch.gitHub;
    this.workplaceSearchGmail = docLinks.links.workplaceSearch.gmail;
    this.workplaceSearchGoogleDrive = docLinks.links.workplaceSearch.googleDrive;
    this.workplaceSearchIndexingSchedule = docLinks.links.workplaceSearch.indexingSchedule;
    this.workplaceSearchJiraCloud = docLinks.links.workplaceSearch.jiraCloud;
    this.workplaceSearchJiraServer = docLinks.links.workplaceSearch.jiraServer;
    this.workplaceSearchNetworkDrive = docLinks.links.workplaceSearch.networkDrive;
    this.workplaceSearchOneDrive = docLinks.links.workplaceSearch.oneDrive;
    this.workplaceSearchPermissions = docLinks.links.workplaceSearch.permissions;
    this.workplaceSearchPrivateSourcePermissions =
      docLinks.links.workplaceSearch.privateSourcePermissions;
    this.workplaceSearchSalesforce = docLinks.links.workplaceSearch.salesforce;
    this.workplaceSearchSecurity = docLinks.links.workplaceSearch.security;
    this.workplaceSearchServiceNow = docLinks.links.workplaceSearch.serviceNow;
    this.workplaceSearchSharePoint = docLinks.links.workplaceSearch.sharePoint;
    this.workplaceSearchSharePointServer = docLinks.links.workplaceSearch.sharePointServer;
    this.workplaceSearchSlack = docLinks.links.workplaceSearch.slack;
    this.workplaceSearchSynch = docLinks.links.workplaceSearch.synch;
    this.workplaceSearchZendesk = docLinks.links.workplaceSearch.zendesk;
  }
}

export const docLinks = new DocLinks();
