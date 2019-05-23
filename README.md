# redux-feathers

Wrap Feathers services to use them as redux actions and put their result into the state.

This package directly depends on [redux-saga-wrapper](https://www.npmjs.com/package/redux-saga-wrapper).

## Installation

```bash
npm i redux-feathers --save
# or
yarn add redux-feathers
```

## How to use

Register Feathers actions:

```javascript
import { createStore } from 'redux-saga-wrapper';
import { createFeathersActions } from 'redux-feathers';

const feathersClient = feathers();

const onFeathersError = console.error;
const actions = createFeathersActions(feathersClient, onFeathersError);

const store = createStore({}, actions);

// ... use store as usual
```

Use Feathers in your components:

```javascript
import { mapDispatchToProps } from 'redux-feathers';

class App extends React.Component {

  // ...

  componentDidMount() {
    this.props.service('users').find({ $limit: 10 });
  }

  // ...
}

const mapStateToProps = state => ({
  users: users && users.list,
})

export default connect(mapStateToProps, mapDispatchToProps)(App);
```