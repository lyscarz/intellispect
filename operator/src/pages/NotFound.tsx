import { Page, Navbar, NavLeft, Link, Block } from 'framework7-react';

export default function NotFound() {
  return (
    <Page name="not-found">
      <Navbar title="Not found">
        <NavLeft>
          <Link back iconF7="chevron_left">
            Back
          </Link>
        </NavLeft>
      </Navbar>
      <Block strong inset style={{ textAlign: 'center' }}>
        This page doesn’t exist.
      </Block>
    </Page>
  );
}
