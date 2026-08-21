import React from 'react';
import { ModalPortal, ModalPortalProps } from './ModalPortal';

export interface ModalProps extends ModalPortalProps {}

export const Modal: React.FC<ModalProps> = (props) => {
  return <ModalPortal {...props} />;
};

