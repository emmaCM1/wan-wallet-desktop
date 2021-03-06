import { observable, action, computed, runInAction, toJS } from 'mobx';
import axios from 'axios';

import wanAddress from './wanAddress';
import { formatNum } from 'utils/support';
import { BigNumber } from 'bignumber.js';

class Portfolio {
  @observable coinPriceArr;

  @observable coinList = ['WAN'];

  @action addCoin (newCoin) {
    if (self.coinList.indexOf(newCoin) === -1) {
      self.coinList.push(newCoin);
      return true
    }
    return false;
  }

  @action updateCoinPrice () {
    axios({
      method: 'GET',
      url: 'https://min-api.cryptocompare.com/data/pricemulti',
      params: {
        fsyms: self.coinList.join(),
        tsyms: 'USD'
      }
    }).then((res) => {
      if (res.status === 200) {
        runInAction(() => {
          self.coinPriceArr = res.data;
        })
      }
    })
  }

  @computed get portfolioList () {
    let list = self.coinList.map((item, index) => Object.defineProperties({}, {
      key: { value: `${index + 1}` },
      name: { value: item },
      price: { value: '$0', writable: true },
      balance: { value: '0', writable: true },
      value: { value: '0', writable: true },
      portfolio: { value: 0, writable: true }
    }));
    if (self.coinPriceArr) {
      let amountValue = 0;
      Object.keys(self.coinPriceArr).forEach((item) => {
        list.forEach((val) => {
          if (val.name === item) {
            switch (item) {
              case 'WAN':
                val.balance = wanAddress.getAllAmount;
                break;
            }
            val.price = `$${self.coinPriceArr[item]['USD']}`;
            val.value = '$' + (new BigNumber(val.price.substr(1)).times(new BigNumber(wanAddress.getAllAmount))).toFixed(2).toString(10);
            amountValue = new BigNumber(amountValue).plus(new BigNumber(val.value.substr(1))).toString(10);
          }
        });
      });
      Object.keys(self.coinPriceArr).forEach((item) => {
        list.forEach(val => {
          if (val.name === item && !new BigNumber(amountValue).isEqualTo(0)) {
            val.portfolio = `${(new BigNumber(val.value.substr(1)).div(new BigNumber(amountValue)).times(100)).toFixed(2).toString(10)}%`;
          }
        });
      });
    }
    list.forEach(item => {
      item.price = `$${formatNum(item.price.substr(1))}`;
      item.balance = formatNum(item.balance);
      item.value = `$${formatNum(item.value.substr(1))}`
    })
    return list;
  }
}

const self = new Portfolio();
export default self;
