import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, Select, message, Row, Col, Spin, Avatar } from 'antd';

import localStyle from './index.less'; // Do not delete this line
import PwdForm from 'componentUtils/PwdForm';
import { toWei, fromWei } from 'utils/support.js';
import { signTransaction } from 'componentUtils/trezor';
import { MAIN, TESTNET, WALLETID } from 'utils/settings';
import CommonFormItem from 'componentUtils/CommonFormItem';
import AddrSelectForm from 'componentUtils/AddrSelectForm';
import DelegationConfirmForm from './DelegationConfirmForm';
import style from 'components/Staking/DelegateInForm/index.less';
import { getNonce, getGasPrice, checkAmountUnit, getChainId, getContractAddr, getStoremanContractData, getValueByAddrInfo } from 'utils/helper';

const colSpan = 6;
const MINAMOUNT = 100;
const ACTION = 'delegateIn';
const pu = require('promisefy-util');
const Confirm = Form.create({ name: 'DelegationConfirmForm' })(DelegationConfirmForm);

@inject(stores => ({
  chainId: stores.session.chainId,
  settings: stores.session.settings,
  addrInfo: stores.wanAddress.addrInfo,
  storemanConf: stores.openstoreman.storemanConf,
  groupChainInfo: stores.openstoreman.groupChainInfo,
  addrSelectedList: stores.wanAddress.addrSelectedList,
  storemanGroupList: stores.openstoreman.storemanGroupList,
  storemanMemberList: stores.openstoreman.storemanMemberList,
  getStoremanMemberList: () => stores.openstoreman.getStoremanMemberList()
}))

@observer
class OsmDelegateInForm extends Component {
  constructor (props) {
    super(props)
    this.state = {
      fee: '0',
      gasPrice: '0',
      gasLimit: '0',
      loading: false,
      record: undefined,
      confirmVisible: false,
      confirmLoading: false,
      storemanInfo: undefined,
      selectedChain: undefined,
    }
  }

  componentDidMount () {
    this.props.getStoremanMemberList();
  }

  getValueByAddrInfoArgs = (...args) => {
    return getValueByAddrInfo(...args, this.props.addrInfo);
  }

  onChangeAddrSelect = value => {
    this.props.form.setFieldsValue({
      balance: value ? this.getValueByAddrInfoArgs(value, 'balance') : 0
    })
  }

  onStoremanChange = value => {
    let { form, storemanMemberList, storemanGroupList, storemanConf } = this.props;
    if (value) {
      let storeman = value.split('/')[0];
      let storemanInfo = storemanMemberList.find(i => i.wkAddr === storeman);
      let groupInfo = storemanGroupList.find(i => i.groupId === storemanInfo.groupId);
      let crosschain = storemanInfo ? `${storemanInfo.chain1[2]} / ${storemanInfo.chain2[2]}` : undefined;
      form.setFieldsValue({
        storeman,
        crosschain,
        quota: storemanInfo ? new BigNumber(fromWei(storemanInfo.deposit) * storemanConf.delegationMulti).minus(fromWei(storemanInfo.delegateDeposit)).toString(10) : '0',
        delegationFee: groupInfo ? groupInfo.delegateFee / 10000 + '%' : '0',
      });
      this.setState({ storemanInfo });
    } else {
      form.setFieldsValue({
        storeman: null,
        quota: '0',
        delegationFee: '0',
      });
      this.setState({ storemanInfo: undefined });
    }
  }

  onCrossChainChange = crosschain => {
    this.props.form.setFieldsValue({ crosschain });
    this.setState({ crosschain });
  }

  checkAmount = (rule, value, callback) => {
    let { form } = this.props;
    let valueStringPre = value.toString().slice(0, 4);
    let { quota, balance } = form.getFieldsValue(['quota', 'balance']);

    if (value === undefined || !checkAmountUnit(18, value)) {
      callback(intl.get('Common.invalidAmount'));
    }
    if (new BigNumber(value).lt('1') || Math.floor(valueStringPre) < 1) {
      callback(intl.get('StakeInForm.stakeTooLow'));
      return;
    }
    if (new BigNumber(value).gte(balance)) {
      callback(intl.get('SendNormalTrans.overBalance'));
      return;
    }
    if (new BigNumber(value).gt(quota)) {
      callback(intl.get('StakeInForm.stakeExceed'));
      return;
    }

    let { myAddr: from } = form.getFieldsValue(['myAddr']);
    if (from && this.state.storemanInfo) {
      let path = this.getValueByAddrInfoArgs(from, 'path');
      let walletID = from.indexOf(':') !== -1 ? WALLETID[from.split(':')[0].toUpperCase()] : WALLETID.NATIVE;
      let tx = {
        walletID,
        BIP44Path: path,
        amount: value,
        wkAddr: this.state.storemanInfo.wkAddr,
        from: from.indexOf(':') === -1 ? from : from.split(':')[1].trim(),
      }
      wand.request('storeman_openStoremanAction', { tx, action: ACTION, isEstimateFee: false }, (err, ret) => {
        if (err) {
          message.warn(intl.get('ValidatorRegister.updateFailed'));
        } else {
          let data = ret.result;
          this.setState({
            gasPrice: data.gasPrice,
            gasLimit: data.estimateGas,
            fee: fromWei(new BigNumber(data.gasPrice).multipliedBy(data.estimateGas).toString(10))
          })
        }
      });
    }

    callback();
  }

  showConfirmForm = () => {
    this.setState({ loading: true })
    let { form, settings } = this.props;
    form.validateFields(async (err) => {
      if (err) {
        this.setState({ loading: false });
        return;
      };
      if (new BigNumber(form.getFieldValue('balance')).minus(form.getFieldValue('amount')).lt(this.state.fee)) {
        this.setState({ loading: false });
        message.warn(intl.get('NormalTransForm.overBalance'));
        return;
      }

      let { myAddr: account, amount, pwd, delegationFee, crosschain, storeman } = form.getFieldsValue(['myAddr', 'amount', 'pwd', 'delegationFee', 'crosschain', 'storeman']);
      if (settings.reinput_pwd) {
        if (!pwd) {
          message.warn(intl.get('Backup.invalidPassword'));
          this.setState({ loading: false });
          return;
        }

        try {
          await pu.promisefy(wand.request, ['phrase_checkPwd', { pwd: pwd }], this);
        } catch (error) {
          message.warn(intl.get('Backup.invalidPassword'));
          this.setState({ loading: false });
          return;
        }
      }

      this.setState({
        loading: false,
        confirmVisible: true,
        record: { amount, account, wkAddr: storeman.split('/')[0], crosschain, delegationFee, }
      });
    })
  }

  onConfirmCancel = () => {
    this.setState({ confirmVisible: false, confirmLoading: false });
  }

  onSend = async () => {
    this.setState({ confirmLoading: true });
    let { form } = this.props;
    let { myAddr: from, amount } = form.getFieldsValue(['myAddr', 'amount']);
    let path = this.getValueByAddrInfoArgs(from, 'path');
    let walletID = from.indexOf(':') !== -1 ? WALLETID[from.split(':')[0].toUpperCase()] : WALLETID.NATIVE;

    from = from.indexOf(':') === -1 ? from : from.split(':')[1].trim();

    let tx = {
      from,
      walletID,
      BIP44Path: path,
      amount: amount.toString(),
      gasLimit: this.state.gasLimit,
      gasPrice: fromWei(this.state.gasPrice),
      wkAddr: this.state.storemanInfo.wkAddr,
    }
    if (walletID === WALLETID.LEDGER) {
      message.info(intl.get('Ledger.signTransactionInLedger'))
    }

    if (walletID === WALLETID.TREZOR) {
      let abiParams = [this.state.storemanInfo.wkAddr];
      let satellite = { wkAddr: this.state.storemanInfo.wkAddr, annotate: 'StoremanDelegateIn' };
      await this.trezorDelegateIn(path, from, amount, ACTION, satellite, abiParams);
      this.setState({ confirmVisible: false });
      this.props.onSend(walletID);
    } else {
      wand.request('storeman_openStoremanAction', { tx, action: ACTION }, (err, ret) => {
        if (err) {
          message.warn(intl.get('ValidatorRegister.updateFailed'));
        } else {
          console.log('validatorModify ret:', ret);
        }
        this.setState({ confirmVisible: false, confirmLoading: false });
        this.props.onSend();
      });
    }
  }

  onClick = () => {
    let href = this.props.chainId === 1 ? `${MAIN}/vlds` : `${TESTNET}/vlds`;
    wand.shell.openExternal(href);
  }

  trezorDelegateIn = async (path, from, value, action, satellite, abiParams) => {
    try {
      let { chainId, nonce, gasPrice, data, to } = await Promise.all([getChainId(), getNonce(from, 'wan'), getGasPrice('wan'), getStoremanContractData(action, ...abiParams), getContractAddr()])
      let rawTx = {
        to,
        from,
        data,
        chainId,
        Txtype: 1,
        value: toWei(value),
        nonce: '0x' + nonce.toString(16),
        gasPrice: toWei(gasPrice, 'gwei'),
        gasLimit: '0x' + Number(200000).toString(16),
      };
      let raw = await pu.promisefy(signTransaction, [path, rawTx], this);// Trezor sign
      let txHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: 'WAN' }], this);
      console.log('Transaction Hash:', txHash);
      let params = {
        txHash,
        from: from.toLowerCase(),
        to: rawTx.to,
        value: rawTx.value,
        gasPrice: rawTx.gasPrice,
        gasLimit: rawTx.gasLimit,
        nonce: rawTx.nonce,
        srcSCAddrKey: 'WAN',
        srcChainType: 'WAN',
        tokenSymbol: 'WAN',
        status: 'Sending',
      }

      await pu.promisefy(wand.request, ['storeman_insertStoremanTransToDB', { tx: params, satellite }], this);
    } catch (error) {
      console.log('Trezor validator append failed', error);
      message.error(intl.get('ValidatorRegister.topUpFailed'));
    }
  }

  render () {
    const { storemanMemberList, form, settings, onCancel, addrSelectedList, groupChainInfo } = this.props;
    const { getFieldDecorator } = form;
    let showConfirmItem = { storeman: true, delegationFee: true, crosschain: true, account: true, amount: true };
    let storemanListSelect = storemanMemberList.filter(i => {
      let crosschain = this.state.crosschain;
      return !crosschain || crosschain === `${i.chain1[2]} / ${i.chain2[2]}`;
    }).map((v, index) => <div value={`${v.wkAddr}/${v.groupId}/${index}`}><Avatar src={v.icon} value={v.nameShowing} size="small" />{v.nameShowing}</div>);

    let crosschainListSelect = groupChainInfo.filter(i => {
      let storemanInfo = this.state.storemanInfo;
      return !storemanInfo || storemanInfo.crosschain === i;
    });

    let spin = storemanMemberList.length !== 0 && groupChainInfo.length !== 0;

    return (
      <div>
        <Modal visible destroyOnClose={true} closable={false} title={intl.get('StakeInForm.title')} onCancel={this.onCancel} className={style['stakein-modal'] + ' spincont'}
          footer={[
            <Button key="back" className="cancel" onClick={onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button disabled={!spin} loading={this.state.loading} key="submit" type="primary" onClick={this.showConfirmForm}>{intl.get('Common.next')}</Button>,
          ]}
        >
          <Spin spinning={!spin} size="large">
            <div className="validator-bg">
              <div className="stakein-title">Storeman's Account</div>
              <div className="validator-line">
                <Row type="flex" justify="space-around" align="middle">
                  <Col span={6}><span className="stakein-name">Cross Chain</span></Col>
                  <Col span={18}>
                    <Form layout="inline" id="osmChainSelect">
                      <Form.Item>
                        {getFieldDecorator('crosschain', {
                          rules: [{ required: false }],
                        })(
                          <Select
                            showSearch
                            allowClear
                            style={{ width: 400 }}
                            placeholder="Select Cross Chain"
                            optionFilterProp="children"
                            onChange={this.onCrossChainChange}
                            getPopupContainer={() => document.getElementById('osmChainSelect')}
                          >
                            {crosschainListSelect.map((item, index) => <Select.Option value={item} key={index}>{item}</Select.Option>)}
                          </Select>
                        )}
                      </Form.Item>
                    </Form>
                  </Col>
                </Row>
              </div>
              <div className="validator-line">
                <Row type="flex" justify="space-around" align="middle" className="storeman">
                  <Col span={6}><span className="stakein-name">Storeman</span></Col>
                  <Col span={15}>
                    <Form layout="inline" id="osmNameSelect">
                      <Form.Item>
                        {getFieldDecorator('storeman', {
                          rules: [{ required: false }],
                        })(
                          <Select
                            showSearch
                            allowClear
                            style={{ width: 400 }}
                            placeholder="Select Storeman Account"
                            optionFilterProp="children"
                            onChange={this.onStoremanChange}
                            getPopupContainer={() => document.getElementById('osmNameSelect')}
                            filterOption={(input, option) => option.props.children.props.children[1].toLowerCase().indexOf(input.toLowerCase()) >= 0}
                          >
                            {storemanListSelect.map((item, index) => <Select.Option value={item.props.value} key={index}>{item}</Select.Option>)}
                          </Select>
                        )}
                      </Form.Item>
                    </Form>
                  </Col>
                  <Col span={3} align="right" className={style['col-stakein-info']}>
                    <a onClick={this.onClick}>{intl.get('StakeInForm.more')}</a>
                  </Col>
                </Row>
              </div>
              <CommonFormItem form={form} formName='quota' disabled={true}
                options={{ initialValue: '0' }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title='Capacity'
                colSpan={colSpan}
              />
              <CommonFormItem form={form} formName='delegationFee' disabled={true}
                options={{ initialValue: '0' }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title='Delegation Fee'
                colSpan={colSpan}
              />
            </div>
            <div className="validator-bg">
              <div className="stakein-title">{intl.get('ValidatorRegister.myAccount')}</div>
              <div className="validator-line">
                <AddrSelectForm form={form} colSpan={6} addrSelectedList={addrSelectedList} handleChange={this.onChangeAddrSelect} getValueByAddrInfoArgs={this.getValueByAddrInfoArgs} />
              </div>
              <CommonFormItem form={form} formName='balance' disabled={true}
                options={{ initialValue: '0' }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('ValidatorRegister.balance')}
                colSpan={colSpan}
              />
              <CommonFormItem form={form} formName='amount'
                options={{ rules: [{ required: true, validator: this.checkAmount }] }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('Common.amount')}
                placeholder={MINAMOUNT}
                colSpan={colSpan}
              />
              <CommonFormItem form={form} formName='fee' disabled={true}
                options={{ initialValue: this.state.fee + ' WAN' }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title="Gas Fee"
                colSpan={colSpan}
              />
              {settings.reinput_pwd && <PwdForm form={form} />}
            </div>
          </Spin>
        </Modal>
        {
          this.state.confirmVisible &&
          <Confirm
            onSend={this.onSend}
            record={this.state.record}
            onCancel={this.onConfirmCancel}
            showConfirmItem={showConfirmItem}
            visible={this.state.confirmVisible}
            confirmLoading={this.state.confirmLoading}
            title={intl.get('NormalTransForm.ConfirmForm.transactionConfirm')}
          />
        }
      </div>
    );
  }
}

export default OsmDelegateInForm;