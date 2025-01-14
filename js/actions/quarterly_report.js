import assert from 'assert';
import axios from 'axios';
import settings from 'settings';
import { List } from 'immutable';

import dispatcher from '../util/dispatcher';
import jsonapi from '../util/json_api';
import localapi from '../util/local_api';
import date from '../util/current_date';
import { FoiaQuarterlyReportRequestBuilder } from '../util/foia_quarterly_report_request_builder';
import quarterlyReportDataFormStore from '../stores/quarterly_report_data_form';
import FoiaQuarterlyReportFilterUtilities from '../util/foia_quarterly_report_filter_utilities';

// Action types to identify an action
export const types = {
  AGENCY_FINDER_DATA_FETCH: 'AGENCY_FINDER_DATA_FETCH',
  AGENCY_FINDER_DATA_RECEIVE: 'AGENCY_FINDER_DATA_RECEIVE',
  AGENCY_FINDER_DATA_COMPLETE: 'AGENCY_FINDER_DATA_COMPLETE',
  AGENCY_COMPONENT_FETCH: 'AGENCY_COMPONENT_FETCH',
  AGENCY_COMPONENT_RECEIVE: 'AGENCY_COMPONENT_RECEIVE',
  QUARTERLY_REPORT_DATA_FETCH: 'QUARTERLY_REPORT_DATA_FETCH',
  QUARTERLY_REPORT_DATA_RECEIVE: 'QUARTERLY_REPORT_DATA_RECEIVE',
  QUARTERLY_REPORT_DATA_COMPLETE: 'QUARTERLY_REPORT_DATA_COMPLETE',
  QUARTERLY_REPORT_FISCAL_YEARS_FETCH: 'QUARTERLY_REPORT_FISCAL_YEARS_FETCH',
  QUARTERLY_REPORT_FISCAL_YEARS_RECEIVE: 'QUARTERLY_REPORT_FISCAL_YEARS_RECEIVE',
  QUARTERLY_REPORT_FISCAL_YEARS_COMPLETE: 'QUARTERLY_REPORT_FISCAL_YEARS_COMPLETE',
  SELECTED_AGENCIES_APPEND_BLANK: 'SELECTED_AGENCIES_APPEND_BLANK',
  SELECTED_AGENCIES_UPDATE: 'SELECTED_AGENCIES_UPDATE',
  QUARTERLY_REPORT_DATA_TYPES_FETCH: 'QUARTERLY_REPORT_DATA_TYPES_FETCH',
  QUARTERLY_REPORT_DATA_TYPES_RECEIVE: 'QUARTERLY_REPORT_DATA_TYPES_RECEIVE',
  QUARTERLY_REPORT_DATA_TYPES_COMPLETE: 'QUARTERLY_REPORT_DATA_TYPES_COMPLETE',
  QUARTERLY_REPORT_DATA_TYPE_UPDATE: 'QUARTERLY_REPORT_DATA_TYPE_UPDATE',
  QUARTERLY_REPORT_DATA_TYPE_FILTER_ADD_GROUP: 'QUARTERLY_REPORT_DATA_TYPE_FILTER_ADD_GROUP',
  QUARTERLY_REPORT_DATA_TYPE_FIELD_REMOVE: 'QUARTERLY_REPORT_DATA_TYPE_FIELD_REMOVE',
  SELECTED_FISCAL_YEARS_UPDATE: 'SELECTED_FISCAL_YEARS_UPDATE',
  SELECTED_QUARTERS_UPDATE: 'SELECTED_QUARTERS_UPDATE',
  SELECTED_AGENCY_COMPONENT_TEMPORARY_UPDATE: 'SELECTED_AGENCY_COMPONENT_TEMPORARY_UPDATE',
  SELECTED_AGENCY_COMPONENT_TEMPORARY_UPDATE_ALL: 'SELECTED_AGENCY_COMPONENT_TEMPORARY_UPDATE_ALL',
  SELECTED_AGENCY_COMPONENTS_DISCARD_TEMPORARY: 'SELECTED_AGENCY_COMPONENTS_DISCARD_TEMPORARY',
  SELECTED_AGENCY_COMPONENTS_MERGE_TEMPORARY: 'SELECTED_AGENCY_COMPONENTS_MERGE_TEMPORARY',
  SELECTED_AGENCIES_TOGGLE_SELECT_ALL: 'SELECTED_AGENCIES_TOGGLE_SELECT_ALL',
  QUARTERLY_REPORT_AGENCY_COMPONENT_REMOVE: 'QUARTERLY_REPORT_AGENCY_COMPONENT_REMOVE',
  QUARTERLY_REPORT_DATA_TYPE_FILTER_UPDATE: 'QUARTERLY_REPORT_DATA_TYPE_FILTER_UPDATE',
  QUARTERLY_REPORT_DATA_TYPE_FILTER_SUBMIT: 'QUARTERLY_REPORT_DATA_TYPE_FILTER_SUBMIT',
  QUARTERLY_REPORT_DATA_TYPE_FILTER_RESET: 'QUARTERLY_REPORT_DATA_TYPE_FILTER_RESET',
  QUARTERLY_REPORT_DATA_TYPE_FILTER_REMOVE: 'QUARTERLY_REPORT_DATA_TYPE_FILTER_REMOVE',
  VALIDATE_FORM: 'VALIDATE_FORM',
  REPORT_SUBMISSION_TYPE: 'REPORT_SUBMISSION_TYPE',
  CLEAR_FORM: 'CLEAR_FORM',
  RELOAD_FORM: 'RELOAD_FORM',
};

// Action creators, to dispatch actions
export const reportActions = {
  fetchAgencyFinderData(includeReferenceFields = null) {
    dispatcher.dispatch({
      type: types.AGENCY_FINDER_DATA_FETCH,
    });

    const referenceFields = includeReferenceFields || {
      agency_component: ['title', 'abbreviation', 'agency', 'field_rep_start'],
      agency: ['name', 'abbreviation', 'description', 'category'],
      'agency.category': ['name'],
    };

    const request = jsonapi.params();
    Object.keys(referenceFields).forEach((field) => {
      if (field !== 'agency_component') {
        request.include(field);
      }
      request.fields(field, referenceFields[field]);
    });

    return request
      .filter('rep_start', 'field_rep_start', date.getCurrentDate('-'))
      .operator('rep_start', '<=')
      .limit(50) // Maximum allowed by drupal
      .paginate('/agency_components', reportActions.receiveAgencyFinderData)
      .then(reportActions.completeAgencyFinderData);
  },

  receiveAgencyFinderData(agencyComponents) {
    dispatcher.dispatch({
      type: types.AGENCY_FINDER_DATA_RECEIVE,
      agencyComponents,
    });

    return Promise.resolve(agencyComponents);
  },

  completeAgencyFinderData() {
    dispatcher.dispatch({
      type: types.AGENCY_FINDER_DATA_COMPLETE,
    });

    return Promise.resolve();
  },

  fetchAgencyComponent(agencyComponentId) {
    assert(agencyComponentId, 'You must provide an agencyComponentId to fetchAgencyComponent.');
    dispatcher.dispatch({
      type: types.AGENCY_COMPONENT_FETCH,
      agencyComponentId,
    });

    return jsonapi.params()
      .include('agency')
      .include('field_misc')
      .include('foia_officers')
      .include('paper_receiver')
      .include('public_liaisons')
      .include('request_form')
      .include('service_centers')
      .get(`/agency_components/${agencyComponentId}`);
  },

  receiveAgencyComponent(agencyComponent) {
    dispatcher.dispatch({
      type: types.AGENCY_COMPONENT_RECEIVE,
      agencyComponent,
    });

    return Promise.resolve(agencyComponent);
  },

  fetchQuarterlyReportDataFiscalYears() {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_FISCAL_YEARS_FETCH,
    });

    const request = axios.create({
      baseURL: settings.api.jsonApiBaseURL,
      headers: { 'X-Api-Key': settings.api.jsonApiKey },
    });

    return request
      .get('/quarterly_foia_report/fiscal_years')
      .then(response => response.data || [])
      .then(reportActions.receiveQuarterlyReportFiscalYearsData)
      .then(reportActions.completeQuarterlyReportFiscalYearsData);
  },

  receiveQuarterlyReportFiscalYearsData(fiscalYears) {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_FISCAL_YEARS_RECEIVE,
      fiscalYears,
    });

    return Promise.resolve(fiscalYears);
  },

  completeQuarterlyReportFiscalYearsData() {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_FISCAL_YEARS_COMPLETE,
    });

    return Promise.resolve();
  },

  fetchQuarterlyReportDataTypes() {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_DATA_TYPES_FETCH,
    });

    return localapi.quarterlyReportDataTypes()
      .then(reportActions.receiveQuarterlyReportDataTypes)
      .then(reportActions.completeQuarterlyReportDataTypes);
  },

  receiveQuarterlyReportDataTypes(quarterlyReportDataTypes) {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_DATA_TYPES_RECEIVE,
      quarterlyReportDataTypes,
    });

    return Promise.resolve();
  },

  completeQuarterlyReportDataTypes() {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_DATA_TYPES_COMPLETE,
    });

    return Promise.resolve();
  },

  updateSelectedFiscalYears(data) {
    dispatcher.dispatch({
      type: types.SELECTED_FISCAL_YEARS_UPDATE,
      data,
    });

    // @todo: Do we need to resolve with any meaningful data here? For now,
    // returning an empty promise for parity with other actions.
    return Promise.resolve();
  },

  updateSelectedQuarters(data) {
    dispatcher.dispatch({
      type: types.SELECTED_QUARTERS_UPDATE,
      data,
    });
  },

  validateForm() {
    dispatcher.dispatch({
      type: types.VALIDATE_FORM,
    });

    return Promise.resolve();
  },

  /**
   * Makes a base report api request with the correct events dispatched
   * while allowing the request to be modified before sending.
   *
   * @param {Array} dataTypes
   *   An array of selected data type objects.
   *
   * @see js/util/json_api_params.js
   * @see js/stores/quarterly_report_data_types.js
   * @see www.foia.gov/api/quarterly-report-form/report_data_map.json
   */
  fetchQuarterlyReportData(dataTypes = []) {
    // Filter out any data type objects that represent empty fields
    // in the form.  This prevents the request from breaking if a user
    // adds a new data type field, but leaves the field empty.
    const validTypes = quarterlyReportDataFormStore.getValidDataTypes(dataTypes);
    const typeGroups = validTypes.reduce((grouped, type) => {
      const typeList = grouped[type.id] || [];
      typeList.push(type);
      grouped[type.id] = typeList;

      return grouped;
    }, {});

    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_DATA_FETCH,
      typesCount: Object.keys(typeGroups).length || 0,
    });

    Object.keys(typeGroups).forEach((key) => {
      let builder = new FoiaQuarterlyReportRequestBuilder();
      // The default limit could be updated in the
      // modifier function if it needs to be.
      builder.request.limit(5);
      builder = this.buildRequestForSelectedType(typeGroups[key], builder);

      return builder
        .request
        .paginate('/quarterly_foia_report', reportActions.receiveQuarterlyReportData)
        .then(reportActions.completeQuarterlyReportData);
    });
  },

  /**
   * Add filters and include fields to a request based on the form state.
   *
   * @param type
   * @param builder
   * @returns {FoiaQuarterlyReportRequestBuilder}
   */
  buildRequestForSelectedType(type, builder) {
    const selectedAgencies = quarterlyReportDataFormStore.buildSelectedAgencies();
    const {
      allAgenciesSelected,
      selectedFiscalYears,
      selectedQuarters,
    } = quarterlyReportDataFormStore.getState();
    const agencies = selectedAgencies.filter(selection => selection.type === 'agency');
    const components = selectedAgencies.filter(selection => selection.type === 'agency_component');
    const dataTypeFilters = FoiaQuarterlyReportFilterUtilities.getFiltersForType(type[0].id);
    const includeOverall = agencies.filter((agency) => {
      const overall = agency
        .components
        .filter(component => component.selected && component.isOverall);

      return List.isList(overall) ? overall.size > 0 : overall.length > 0;
    }).length > 0;

    let updatedBuilder = builder;
    if (includeOverall) {
      updatedBuilder = updatedBuilder.includeOverallFields(type);
    }

    if (!allAgenciesSelected) {
      updatedBuilder = updatedBuilder
        .includeDataTypes(type)
        .addOrganizationsGroup({
          agencies: agencies.map(agency => agency.abbreviation),
          components: components.map(component => component.abbreviation),
        });
    }

    return updatedBuilder
      .addDataTypeFiltersGroup(dataTypeFilters, type[0].id)
      .addFiscalYearsGroup(selectedFiscalYears)
      .addQuartersGroup(selectedQuarters);
  },

  receiveQuarterlyReportData(quarterlyReports) {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_DATA_RECEIVE,
      quarterlyReports,
    });
    return Promise.resolve(quarterlyReports);
  },

  completeQuarterlyReportData() {
    dispatcher.dispatch({
      type: types.QUARTERLY_REPORT_DATA_COMPLETE,
    });

    return Promise.resolve();
  },

  clearForm() {
    dispatcher.dispatch({
      type: types.CLEAR_FORM,
    });

    return Promise.resolve();
  },

  reloadForm(viewMode) {
    dispatcher.dispatch({
      type: types.RELOAD_FORM,
      viewMode,
    });

    return Promise.resolve();
  },
};
