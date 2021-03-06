import {User} from '../../services/apis/types';
import {Action, createReducer, on} from '@ngrx/store';
import {loginSuccess, logoutSuccess, setUser} from './action';

export const contextFeatureKey = 'context';

export interface ContextState {
  user: User;
  token: string;
}

export const initialState: ContextState = {
  token: '',
  user: null
}

const reducer = createReducer(
  initialState,
  on(setUser, (state, user) => ({ ...state, user })),
  on(loginSuccess, (state, { user, token }) => ({ user, token })),
  on(logoutSuccess, state => ({ user: null, token: '' }))
);

export function contextReducer(state: ContextState, action: Action): ContextState {
  return reducer(state, action);
}
