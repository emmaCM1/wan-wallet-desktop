import React from 'react';
import { withRouter, Switch, Route } from 'react-router-dom';
import menuList from 'constants/menuConfig';
import { Layout, Portfolio, Wallet } from './containers';

const Main = withRouter(props => <Layout {...props} />);

export default () => {
  return (
      <Main>
        <Switch>
          <Route exact path={menuList[0].key} component={Portfolio} />
          <Route path={menuList[1].key} component={Wallet} />
        </Switch>
      </Main>
  );
};