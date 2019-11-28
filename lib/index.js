import _ from 'lodash';
import update from 'immutability-helper';
import { bindActionCreators } from 'redux';
import { put } from 'redux-saga/effects';
import { actionCreators } from 'redux-saga-wrapper';

function reduceMultiple(state, service, response, idField) {
  if (response.data.length && !response.data[0][idField]) {
    response.data = response.data.map((item, idx) => ({ ...item, [idField]: idx + (response.skip || 0) }));
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

const createFeathersActions = (feathersClient, onErrorCallback, idField = '_id') => ({
  callFeathers: {
    *saga(service, method, ...args) {
      return yield feathersClient.service(service)[method](...args);
    },
  },
  subscribeFeathersService: {
    *saga(service, dispatch) {
      const subscribeTo = event => feathersClient.service(service).on(event, async data => {
        dispatch(actionCreators.callFeathersSuccess(data, {
          payload: [ service, event.slice(0, event.length - 1) ],
        }));
      });

      subscribeTo('created');
      subscribeTo('patched');
      subscribeTo('updated');
      subscribeTo('removed');
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
    find: (query) => dispatch(actionCreators.callFeathers(name, 'find', { query })),
    get: (id, params) => dispatch(actionCreators.callFeathers(name, 'get', id, params)),
    create: (data, params) => dispatch(actionCreators.callFeathers(name, 'create', data, params)),
    update: (id, data, params) => dispatch(actionCreators.callFeathers(name, 'update', id, data, params)),
    patch: (id, data, params) => dispatch(actionCreators.callFeathers(name, 'patch', id, data, params)),
    remove: (id, params) => dispatch(actionCreators.callFeathers(name, 'remove', id, params)),
    subscribe: () => dispatch(actionCreators.subscribeFeathersService(name, dispatch)),
  }),
});

export {
  createFeathersActions,
  mapDispatchToProps,
};
