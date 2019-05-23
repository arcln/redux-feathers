import _ from 'lodash';
import update from 'immutability-helper';
import { bindActionCreators } from 'redux';
import { actionCreators } from 'redux-saga-wrapper';

function reduceMultiple(state, service, response) {
  if (!response.data.length) {
    return state;
  }
  
  if (!response.data[0].id) {
    response.data = response.data.map((item, idx) => ({ ...item, id: idx + response.skip }));
  }

  const data = response.data.reduce((acc, item) => {
    acc[item.id] = item;
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

function reduceOne(state, service, response) {
  if (typeof response.id === 'undefined') {
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
          [response.id]: response
        },
      },
    },
  });
}

function deleteOne(state, service, response) {
  if (typeof response.id === 'undefined') {
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
        list: _.omit(list, [response.id]),
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

const createFeathersActions = (feathersClient, onErrorCallback) => ({
  callFeathers: {
    *saga(action) {
      const [ service, method, ...args ] = action.payload;
      return yield feathersClient.service(service)[method](...args);
    },
  },
  callFeathersSuccess: {
    reducer(state, [ response, action ]) {
      const [ service, method ] = action.payload;

      switch (method) {
        case 'find': return reduceMultiple(state, service, response);
        case 'remove': return deleteOne(state, service, response);
        default: return reduceOne(state, service, response);
      }
    },
  },
  callFeathersFailed: {
    *saga({ payload }) {
      onErrorCallback && onErrorCallback(payload);
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
  }),
});

export {
  createFeathersActions,
  mapDispatchToProps,
};
