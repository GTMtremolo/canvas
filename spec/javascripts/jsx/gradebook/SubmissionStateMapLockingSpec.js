/*
 * Copyright (C) 2016 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import SubmissionStateMap from '@canvas/grading/SubmissionStateMap'

const student = {
  id: '1',
  group_ids: ['1'],
  sections: ['1']
}

function createMap(opts = {}) {
  const defaults = {
    hasGradingPeriods: false,
    selectedGradingPeriodID: '0',
    isAdmin: false
  }

  const params = {...defaults, ...opts}
  return new SubmissionStateMap(params)
}

function createAndSetupMap(assignment, opts = {}) {
  const map = createMap(opts)
  const assignments = {}
  assignments[assignment.id] = assignment
  map.setup([student], assignments)
  return map
}

// TODO: the spec setup above should live in a spec helper -- at the
// time this is being written a significant amount of work is needed
// to be able to require javascript files that live in the spec directory

QUnit.module('SubmissionStateMap without grading periods')

test('submission in an unpublished assignment is locked', () => {
  const assignment = {id: '1', published: false, effectiveDueDates: {}}
  const map = createAndSetupMap(assignment, {hasGradingPeriods: false})
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  strictEqual(state.locked, true)
})

test('submission in a published assignment is not locked', () => {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  const map = createAndSetupMap(assignment, {hasGradingPeriods: false})
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  strictEqual(state.locked, false)
})

test('submission is locked for a student without assignment visibility', () => {
  const assignment = {
    id: '1',
    published: true,
    effectiveDueDates: {},
    only_visible_to_overrides: true
  }
  const map = createAndSetupMap(assignment, {hasGradingPeriods: false})
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, true)
})

test('submission is unlocked for an assigned student', () => {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: null,
    grading_period_id: null,
    in_closed_grading_period: false
  }

  const map = createAndSetupMap(assignment, {hasGradingPeriods: false})
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, false)
})

QUnit.module('SubmissionStateMap with grading periods and all grading periods selected', {
  setup() {
    this.DATE_IN_CLOSED_PERIOD = '2015-07-15'
    this.DATE_NOT_IN_CLOSED_PERIOD = '2015-08-15'
    this.mapOptions = {hasGradingPeriods: true, selectedGradingPeriodID: '0'}
  }
})

test('submission is locked for a student without assignment visibility', function() {
  const assignment = {
    id: '1',
    published: true,
    effectiveDueDates: {},
    only_visible_to_overrides: true
  }
  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, true)
})

test('submission is locked for an assigned student with assignment due in a closed grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_IN_CLOSED_PERIOD,
    grading_period_id: '1',
    in_closed_grading_period: true
  }

  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, true)
})

test('user is admin: submission is unlocked for an assigned student with assignment due in a closed grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_IN_CLOSED_PERIOD,
    grading_period_id: '1',
    in_closed_grading_period: true
  }

  const mapOptions = {...this.mapOptions, isAdmin: true}
  const map = createAndSetupMap(assignment, mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, false)
})

test('submission is unlocked for an assigned student with assignment due outside of a closed grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_NOT_IN_CLOSED_PERIOD,
    grading_period_id: '1',
    in_closed_grading_period: false
  }

  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, false)
})

QUnit.module('SubmissionStateMap with grading periods and a non-closed grading period selected', {
  setup() {
    this.DATE_IN_SELECTED_PERIOD = '2015-07-15'
    this.DATE_NOT_IN_SELECTED_PERIOD = '2015-08-15'
    this.SELECTED_PERIOD_ID = '1'
    this.mapOptions = {hasGradingPeriods: true, selectedGradingPeriodID: this.SELECTED_PERIOD_ID}
  }
})

test('submission is locked for an assigned student with assignment due outside of the selected grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_NOT_IN_SELECTED_PERIOD,
    grading_period_id: '2',
    in_closed_grading_period: false
  }

  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, true)
})

test('submission is unlocked for an assigned student with assignment due in the selected grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_IN_SELECTED_PERIOD,
    grading_period_id: this.SELECTED_PERIOD_ID,
    in_closed_grading_period: false
  }

  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, false)
})

QUnit.module('SubmissionStateMap with grading periods and a closed grading period selected', {
  setup() {
    this.DATE_IN_SELECTED_PERIOD = '2015-07-15'
    this.DATE_NOT_IN_SELECTED_PERIOD = '2015-08-15'
    this.SELECTED_PERIOD_ID = '1'
    this.mapOptions = {hasGradingPeriods: true, selectedGradingPeriodID: this.SELECTED_PERIOD_ID}
  }
})

test('submission is locked for an assigned student with assignment due outside of the selected grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_NOT_IN_SELECTED_PERIOD,
    grading_period_id: '2',
    in_closed_grading_period: false
  }

  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, true)
})

test('submission is locked for an assigned student with assignment due in the selected grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_IN_SELECTED_PERIOD,
    grading_period_id: this.SELECTED_PERIOD_ID,
    in_closed_grading_period: true
  }

  const map = createAndSetupMap(assignment, this.mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, true)
})

test('user is admin: submission is unlocked for an assigned student with assignment due in the selected grading period', function() {
  const assignment = {id: '1', published: true, effectiveDueDates: {}}
  assignment.effectiveDueDates[student.id] = {
    due_at: this.DATE_IN_SELECTED_PERIOD,
    grading_period_id: this.SELECTED_PERIOD_ID,
    in_closed_grading_period: true
  }

  const mapOptions = {...this.mapOptions, isAdmin: true}
  const map = createAndSetupMap(assignment, mapOptions)
  const state = map.getSubmissionState({user_id: student.id, assignment_id: assignment.id})
  equal(state.locked, false)
})
