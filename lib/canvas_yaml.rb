# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# This is an initializer, but needs to be required earlier in the load process,
# and before canvas-jobs

# We need to make sure that safe_yaml is loaded *after* the YAML engine
# is switched to Psych. Otherwise we
# won't have access to (safe|unsafe)_load.
require 'yaml'
require 'date' if RUBY_VERSION >= "2.5.0"
require 'safe_yaml'

module FixSafeYAMLNullMerge
  def merge_into_hash(hash, array)
    return unless array
    super
  end
end
SafeYAML::Resolver.prepend(FixSafeYAMLNullMerge)

SafeYAML::OPTIONS.merge!(
    default_mode: :safe,
    deserialize_symbols: true,
    raise_on_unknown_tag: true,
    # This tag whitelist is syck specific. We'll need to tweak it when we upgrade to psych.
    # See the tests in spec/lib/safe_yaml_spec.rb
    whitelisted_tags: %w[
        !ruby/sym
        !ruby/symbol
        !binary
        !float
        !float#exp
        !float#inf
        !str
        tag:yaml.org,2002:str
        !timestamp
        !timestamp#iso8601
        !timestamp#spaced
        !map:HashWithIndifferentAccess
        !map:ActiveSupport::HashWithIndifferentAccess
        !map:WeakParameters
        !ruby/hash:HashWithIndifferentAccess
        !ruby/hash:ActiveSupport::HashWithIndifferentAccess
        !ruby/hash:WeakParameters
        !ruby/hash:ActionController::Parameters
        !ruby/object:Class
        !ruby/object:OpenStruct
        !ruby/object:Mime::Type
        !ruby/object:Mime::NullType
        !ruby/object:URI::HTTP
        !ruby/object:URI::HTTPS
        !ruby/object:OpenObject
        !ruby/object:DateTime
        !ruby/object:BigDecimal
        !ruby/object:ActiveSupport::TimeWithZone
        !ruby/object:ActiveSupport::TimeZone
      ],
)

module Syckness
  TAG = "#GETDOWNWITHTHESYCKNESS\n"
end

SafeYAML::PsychResolver.class_eval do
  attr_accessor :aliased_nodes
end

module AddClassWhitelist
  SafeYAML::OPTIONS[:whitelisted_classes] ||= []

  # This isn't really a bang method but it has been included here to maintain
  # consistency with SafeYAML's whitelist! methods
  def whitelist_classes!(*constants)
    constants.each do |const|
      whitelist_constant!(const)
    end
  end

  def whitelist_class!(const)
    const_name = const.name

    raise "#{const} cannont be anonymous" unless const_name.present?
    SafeYAML::OPTIONS[:whitelisted_classes] << const_name
  end
end
SafeYAML.singleton_class.prepend(AddClassWhitelist)

module MaintainAliases
  def accept(node)
    if node.respond_to?(:anchor) && node.anchor && @resolver.get_node_type(node) != :alias
      @resolver.aliased_nodes[node.anchor] = node
    end
    super
  end
end
SafeYAML::SafeToRubyVisitor.prepend(MaintainAliases)

module AcceptClasses
  def accept(node)
    if node.tag && node.tag == '!ruby/class'
      val = node.value
      if @resolver.options[:whitelisted_classes].include?(val)
        val.constantize
      else
        raise "YAML deserialization of constant not allowed: #{val}"
      end
    else
      super
    end
  end
end
SafeYAML::SafeToRubyVisitor.prepend(AcceptClasses)

module ResolveClasses
  def resolve_scalar(node)
    if node.tag && node.tag == '!ruby/class'
      val = node.value
      if options[:whitelisted_classes].include?(val)
        val.constantize
      else
        raise "YAML deserialization of constant not allowed: #{val}"
      end
    else
      super
    end
  end
end
SafeYAML::Resolver.prepend(ResolveClasses)

module ScalarScannerFix
  # in rubies < 2.7, Psych uses a regex to identify an integer, then strips commas and underscores,
  # then checks _again_ against the regex. In 2.7, the second check was eliminated because the
  # stripping was inlined in the name of optimization to avoid a string allocation. unfortunately
  # this means something like 0x_ which passes the first check is not a valid number, and will
  # throw an exception. this is the simplest way to catch that case without completely reverting
  # the optimization
  def parse_int(string)
    super
  rescue ArgumentError
    string
  end
end
Psych::ScalarScanner.prepend(ScalarScannerFix)

module ScalarTransformFix
  def to_guessed_type(value, quoted=false, options=nil)
    return value if quoted

    if value.is_a?(String)
      @ss ||= Psych::ScalarScanner.new(Psych::ClassLoader.new)
      return @ss.tokenize(value) # just skip straight to Psych if it's a scalar because SafeYAML's transform mades me a sad panda
    end

    value
  end
end
SafeYAML::Transform.singleton_class.prepend(ScalarTransformFix)

module YAMLSingletonFix
  def revive(klass, node)
    if klass < Singleton
      klass.instance
    elsif klass == Set
      super.tap{|s| s.instance_variable_get(:@hash).default = false}
    else
      super
    end
  end
end
Psych::Visitors::ToRuby.prepend(YAMLSingletonFix)
