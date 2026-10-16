// The table and footer have no test ids, so these lean on attributes and accessible names.
export const SELECTORS = {
  // View picker button, text is "All Opportunities · 150".
  viewCount: '[aria-controls^="view-picker-"]',
  tableRow: '[data-testid^="row-id-"]',
  // Name is always the first column; the span skips the avatar letter in the chip.
  rowNameCell: '[data-record-table-col="0"] span[dir="auto"]',
  // Only matches once Amount has an aggregate ("Average of Amount"), not while it shows "Calculate".
  amountFooterCell: '[aria-haspopup="dialog"]:has-text(" of Amount")',
  amountFooterLabel: '[aria-haspopup="dialog"]:has-text(" of Amount") div[dir="auto"]',
  amountFooterValue: '[aria-haspopup="dialog"]:has-text(" of Amount") div[dir="auto"] + div',
  aggregateMenu: 'role=dialog',
  sidePanel: 'aside',
  sidePanelNameInput: 'role=textbox[name="Name"s]',
  sidePanelCurrencyButton: 'role=button[name="No currency"s]',
  sidePanelCurrencySearch: 'role=searchbox[name="Currency Code"s]',
  sidePanelAmountInput: 'role=textbox[name="Amount"s]',
  sidePanelCreateButton: '[data-testid="record-creation-form-create-button"]',
  sidePanelClose: 'role=button[name="Close side panel"s]',
};
