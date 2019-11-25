import _ from 'lodash';
import update from 'immutability-helper';
import { bindActionCreators } from 'redux';
import { actionCreators } from 'redux-saga-wrapper';

function reduceMultiple(state, service, response, idField) {
  if (!response.data.length) {
    return state;
  }

  if (!response.data[0][idField]) {
    response.data = response.data.map((item, idx) => ({ ...item, id: idx + response.skip }));
  }

  const data = response.data.reduce((acc, item) => {
    acc[item[idField]] = item;
    return acc;
  }, {});

  return update(addServiceKey(state, service), {
    [service]: {
      list: {
        $merge: data,
      },
    },
  });
}

function reduceOne(state, service, response, idField) {
  if (typeof response[idField] === 'undefined') {
    return update(addServiceKey(state, service), {
      [service]: {
        $merge: {
          query: response,
        },
      },
    });
  }

  return update(addServiceKey(state, service), {
    [service]: {
      list: {
        $merge: {
          [response[idField]]: response
        },
      },
    },
  });
}

function deleteOne(state, service, response, idField) {
  if (typeof response[idField] === 'undefined') {
    return update(addServiceKey(state, service), {
      [service]: {
        $merge: {
          query: response,
        },
      },
    });
  }

  const newState = addServiceKey(state, service);
  const list = newState[service].list;
  return update(newState, {
    [service]: {
      $set: {
        list: _.omit(list, [response[idField]]),
      },
    },
  });

  return state;
}

function addServiceKey(state, service) {
  if (!state[service]) {
    return update(state, {
      $merge: {
        [service]: {
          list: {},
        },
      },
    });
  }

  return state;
}

const subscribeTo = (client, service, dispatch, event) => client.service(service).on(event, data => dispatch(actionCreators.callFeathersSuccess(data, {
  payload: [ service, event.slice(0, event.length - 1) ],
})));

const createFeathersActions = (feathersClient, onErrorCallback, idField = '_id') => ({
  callFeathers: {
    *saga(service, method, options, ...args) {
      if (options.subscribe) {
        subscribeTo(feathersClient, service, options.dispatch, 'created');
        subscribeTo(feathersClient, service, options.dispatch, 'patched');
        subscribeTo(feathersClient, service, options.dispatch, 'updated');
        subscribeTo(feathersClient, service, options.dispatch, 'removed');
      }

      return yield feathersClient.service(service)[method](...args);
    },
  },
  callFeathersSuccess: {
    reducer(state, response, action) {
      const [ service, method ] = action.payload;
      switch (method) {
        case 'find': return reduceMultiple(state, service, response, idField);
        case 'remove': return deleteOne(state, service, response, idField);
        default: return reduceOne(state, service, response, idField);
      }
    },
  },
  callFeathersFailed: {
    *saga(...args) {
      onErrorCallback && onErrorCallback(...args);
    },
  },
});

const mapDispatchToProps = dispatch => ({
  actions: bindActionCreators(actionCreators, dispatch),
  service: name => ({
    find: (query, subscribe) => dispatch(actionCreators.callFeathers(name, 'find', { subscribe, dispatch }, { query })),
    get: (id, params, subscribe) => dispatch(actionCreators.callFeathers(name, 'get', { subscribe, dispatch }, id, params)),
    create: (data, params, subscribe) => dispatch(actionCreators.callFeathers(name, 'create', { subscribe, dispatch }, data, params)),
    update: (id, data, params, subscribe) => dispatch(actionCreators.callFeathers(name, 'update', { subscribe, dispatch }, id, data, params)),
    patch: (id, data, params, subscribe) => dispatch(actionCreators.callFeathers(name, 'patch', { subscribe, dispatch }, id, data, params)),
    remove: (id, params, subscribe) => dispatch(actionCreators.callFeathers(name, 'remove', { subscribe, dispatch }, id, params)),
  }),
});

export {
  createFeathersActions,
  mapDispatchToProps,
};
