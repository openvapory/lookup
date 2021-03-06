'use strict'

const web3 = require('./web3')
const tokenReg = require('./token-reg')
const resolveGitHubHint = require('./resolve-github-hint')
const BigNumber = require('bignumber.js')

const {zero32} = require('./util')

const abi = require('../contracts/EIP20.json')

const nrOfTokens = +tokenReg.tokenCount.call()
const allTokens = []

for (let id = 0; id < nrOfTokens; id++) {
  const [address, TLA, base, name] = tokenReg.token.call(id)

  let img = tokenReg.meta.call(id, 'IMG')
  img = img === zero32 ? null : resolveGitHubHint(img)

  allTokens.push({
    id, address, TLA, base, name, img
  })
}

const tokenBalanceOfAddress = (address, token) => {
  const contract = web3.eth.contract(abi).at(token.address)

  return new Promise((resolve, reject) => {
    contract.balanceOf(address, (err, balance) => {
      if (err) reject(err)
      else resolve(balance.dividedBy(token.base))
    })
  })
}

const ETH = {
  TLA: 'ETH',
  name: 'Ether',
  base: new BigNumber('1e+18'),
  img: 'https://raw.githubusercontent.com/ethcore/parity/1e6a2cb/js/assets/images/contracts/ethereum-black-64x64.png'
}

const ethOfAddress = (address) => new Promise((resolve, reject) => {
  web3.eth.getBalance(address, (err, balance) => {
    if (err) reject(err)
    else resolve(balance.dividedBy(ETH.base))
  })
})

const tokenBalancesOfAddress = (address) => {
  const tasks = allTokens.map((token) =>
    tokenBalanceOfAddress(address, token)
    .catch(() => new BigNumber(0)) // in case of an error we assume address has 0
    .then((balance) => Object.assign({}, token, {balance}))
  ).concat(
    ethOfAddress(address)
    .catch(() => new BigNumber(0)) // in case of an error we assume address has 0
    .then((balance) => Object.assign({}, ETH, {balance}))
  )

  return Promise.all(tasks)
  .then((tokens) =>
    tokens
    .filter(({balance}) => balance.gt(0))
    .map((token) => Object.assign({}, token, {balance: token.balance.toJSON()}))
  )
}

module.exports = tokenBalancesOfAddress
