import React from 'react';
import { HashRouter, withRouter, Switch, Route } from 'react-router-dom';
import { Layout, Portfolio, WanAccount, Settings, Trezor, Ledger, Delegation, Validator, Offline } from './containers';

const Main = withRouter(props => <Layout {...props} />);

export default () => {
  return (
      <HashRouter>
        <Main>
          <Switch>
            <Route exact path="/" component={Portfolio} />
            <Route path="/wanAccount" component={WanAccount} />
            <Route path="/settings" component={Settings} />
            <Route path="/trezor" component={Trezor} />
            <Route path="/ledger" component={Ledger} />
            <Route path="/offline" component={Offline} />
            <Route path="/delegation" component={Delegation} />
            <Route path="/validator" component={Validator} />
          </Switch>
        </Main>
      </HashRouter>
  );
};
